#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import * as semver from "semver";
import * as tmp from "tmp";
import * as util from "util";

import { convertStrVersionToInt, getChartYaml, writeChartYaml } from "./Harbor";
import { Helm } from "./Helm";
import { retrieveRequestFromStdin } from "./index";
import { IOutRequest, IResponse } from "./index";
import { IHelm } from "./types/Helm";

const lstat = util.promisify(fs.lstat);
const readFile = util.promisify(fs.readFile);
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function createTmpDir(): Promise<{ path: string, cleanupCallback: () => void }> {
  return new Promise<{ path: string, cleanupCallback: () => void }>((resolve, reject) => {
    tmp.dir((err, pathVal, cleanupCallback) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          cleanupCallback,
          path: pathVal,
        });
      }
    });
  });
}

export default async function out() {
  // Determine build path and decend into it.
  if (process.argv.length !== 3) {
      process.stderr.write(`Expected exactly one argument (root), got ${process.argv.length - 2}.\n`);
      process.exit(102);
  }
  const root = path.resolve(process.argv[2]);
  process.chdir(root);

  let request: IOutRequest;
  try {
    request = await retrieveRequestFromStdin<IOutRequest>();
  } catch (e) {
    process.stderr.write("Unable to retrieve JSON data from stdin.\n");
    process.stderr.write(e);
    process.exit(502);
    throw (e);
  }

  if (!request.params.version && !request.params.version_file) {
    process.stderr.write("No version found. Either version or version_file param must be provided.\n");
    process.exit(502);
  }

  // If either params.version or params.version_file have been specified,
  // we'll read our version information for packaging the Helm Chart from
  // there.
  let version = request.params.version;
  if (request.params.version_file != null) {
    const versionFile = path.resolve(request.params.version_file);
    if ((await lstat(versionFile)).isFile()) {
      // version_file exists. Cool... let's read it's contents.
      version = (await readFile(versionFile)).toString().replace(/\r?\n/, "");
    }
  }
  if (version != null && request.source.version_range != null) {
    const versionRange = request.source.version_range;
    if (!semver.satisfies(version, versionRange)) {
      process.stderr.write(
        `params.version (${version}) does not satisfy contents of source.version_range (${versionRange}).\n`);
      process.exit(104);
    }
  }

  const chartLocation = path.resolve(request.params.chart);
  process.stderr.write(`Processing chart at "${chartLocation}"...\n`);

  const chartFileStat = await lstat(chartLocation);
  if (!chartFileStat.isDirectory()) {
    process.stderr.write(`Chart file (${chartLocation}) not found.\n`);
    process.exit(110);
  }

  const chartObj = getChartYaml(chartLocation);
  if (request.params.set_app_version && version) { chartObj.appVersion = version; }
  if (version) { chartObj.version = version; }
  writeChartYaml(chartLocation, chartObj);

  const helmObj: IHelm = {
    appVersion: chartObj.appVersion,
    chartLocation,
    chartVersion: chartObj.version,
    tempDirectory: await createTmpDir(),
  };

  const helm = new Helm(helmObj, request);
  await helm.InitHelmChart(async () => {
    const chartFile = await helm.GetChartPackage();
    if (!await helm.CheckPackageExists(chartFile)) {
      process.stderr.write("Cannot find packaged helm chart.\n");
      process.exit(160);
    }
    await helm.UploadChart(chartFile);
    // Race condition on scanning in Harbor. Adding attempts.
    for (let attempts = 0; attempts < 3; attempts++) {
        const chartJson = await helm.FetchChart(attempts);
        if (chartJson == null) {
          process.stderr.write(`Failed to find chart. Attempt ${attempts} of 3 retrying...\n`);
          await delay(5000)
          continue;
        }
        if (chartObj.version !== chartJson.metadata.version) {
          process.stderr.write(
            `Version mismatch in uploaded Helm Chart.
            Got: ${chartJson.metadata.version}, expected: ${chartObj.version}.\n`);
          process.exit(203);
        }
        const response: IResponse = {
          metadata: [
            { name: "created", value: chartJson.metadata.created },
            { name: "description", value: chartJson.metadata.description },
            { name: "appVersion", value: chartJson.metadata.appVersion },
          ],
          version: {
            digest: chartJson.metadata.digest,
            version: chartJson.metadata.version,
          },
        };
        process.stdout.write(JSON.stringify(response));
        process.exit(0);
      }
    });
}

(async () => {
  process.on("unhandledRejection", (err) => {
    process.stderr.write(err != null ? err.toString() : "UNKNOWN ERROR");
    process.exit(-1);
  });
  await out();
})();



