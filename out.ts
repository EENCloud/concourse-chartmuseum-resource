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
  // // Determine build path and decend into it.
  // if (process.argv.length !== 3) {
  //     process.stderr.write(`Expected exactly one argument (root), got ${process.argv.length - 2}.\n`);
  //     process.exit(102);
  // }
  // const root = path.resolve(process.argv[2]);
  const root = path.resolve("/tmp/");
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

  // If either params.version or params.version_file have been specified,
  // we'll read our version information for packaging the Helm Chart from
  // there.
  const appVersion = request.params.app_version;
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
  const helmObj: IHelm = {
    appVersion,
    chartLocation,
    tempDirectory: await createTmpDir(),
    version,
  };

  const helm = new Helm(helmObj, request);
  const chartObj = getChartYaml(helm.helmProps.chartLocation);
  if (version) {
    chartObj.appVersion = version;
  } else {
    process.stderr.write("No version or version file passed...\n");
    process.stderr.write("Incrementing patch version found in Chart.yaml.\n");
    let [major, minor, patch] = convertStrVersionToInt(chartObj.appVersion);
    patch++;
    chartObj.appVersion = `${major.toString()}.${minor.toString()}.${patch.toString()}`;
    helm.helmProps.appVersion = `${major.toString()}.${minor.toString()}.${patch.toString()}`;
  }
  writeChartYaml(helm.helmProps.chartLocation, chartObj);
  await helm.InitHelmChart(async () => {
    const chartFile = await helm.GetChartPackage();
    if (!await helm.CheckPackageExists(chartFile)) {
      process.stderr.write("Cannot find packaged helm chart.\n");
      process.exit(160);
    }
    await helm.UploadChart(chartFile);
    const chartJson = await helm.FetchChart();
    if (helm.helmProps.version !== chartJson.metadata.version) {
        process.stderr.write(
          `Version mismatch in uploaded Helm Chart.
          Got: ${chartJson.metadata.version}, expected: ${helm.helmProps.version}.\n`);
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
  });
}

(async () => {
  process.on("unhandledRejection", (err) => {
    process.stderr.write(err != null ? err.toString() : "UNKNOWN ERROR");
    process.exit(-1);
  });
  await out();
})();



