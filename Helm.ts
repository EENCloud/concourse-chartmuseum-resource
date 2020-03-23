import * as child_process from "child_process";
import * as FormData from "form-data";
import * as fs from "fs";
import lineReader = require("line-reader");
import fetch, { Response } from "node-fetch";
import * as os from "os";
import * as path from "path";
import * as rimraf from "rimraf";
import * as util from "util";
import * as yaml from "yamljs";
import { createFetchHeaders, IOutRequest } from ".";
import { IHarborChartJSON } from "./types";
import { IHelm, IHelmRepository } from "./types/Helm";

const execSync = util.promisify(child_process.exec);
const writeFile = util.promisify(fs.writeFile);
const mkdtemp = util.promisify(fs.mkdtemp);
const deltree = util.promisify(rimraf);

export class Helm {
  public helmProps: IHelm;
  public request: IOutRequest;
  constructor(helmProps: IHelm, request: IOutRequest) {
    this.helmProps = helmProps;
    this.request = request;
  }

  public async GetChartPackage(): Promise<string> {
    const chartInfo = yaml.load(path.resolve(this.helmProps.chartLocation, "Chart.yaml"));

    return path.resolve(
      this.helmProps.tempDirectory.path,
      `${chartInfo.name}-${this.helmProps.chartVersion}.tgz`,
    );
  }

  public UploadChart = async (chartFile: string) => {
    const formData = new FormData();
    formData.append("chart", fs.createReadStream(chartFile));
    let postResult: Response;
    try {
      let postUrl = `${this.request.source.server_url}api/chartrepo/${this.request.source.project}/charts`;
      process.stderr.write(`Uploading chart file: "${chartFile}" to "${postUrl}"... \n`);
      if (this.request.params.force) {
        postUrl += "?force=true";
      }
      postResult = await fetch(postUrl, {
        body: formData,
        headers: createFetchHeaders(this.request),
        method: "POST",
      });
    } catch (e) {
      process.stderr.write("Upload of chart file has failed.\n");
      throw e;
    }

    if (postResult.status !== 201) {
      process.stderr.write(
        `An error occured while uploading the chart: "${postResult.status} - ${postResult.statusText}".\n`);
      process.exit(postResult.status);
    }

    const postResultJson = await postResult.json();
    if (postResultJson.error != null) {
      process.stderr.write(`An error occured while uploading the chart: "${postResultJson.error}".\n`);
      process.exit(602);
    } else if (postResultJson.saved !== true) {
      process.stderr.write(
        `Helm chart has not been saved. (Return value from server: saved=${postResultJson.saved})\n`);
      process.exit(603);
    }
    process.stderr.write("Helm Chart has been uploaded.\n");
    process.stderr.write(`- Name: ${this.request.source.chart_name}\n`);
    process.stderr.write(`- Version: ${this.helmProps.chartVersion}\n\n`);
  }

  public FetchChart = async (): Promise<IHarborChartJSON> => {
    // Fetch Chart that has just been uploaded.
    const headers = createFetchHeaders(this.request); // We need new headers. (Content-Length should be "0" again...)
    const chartInfoUrl = `${this.request.source.server_url}api/chartrepo/${this.request.source.project}/charts/${this.request.source.chart_name}/${this.helmProps.chartVersion}`;
    process.stderr.write(`Fetching chart data from "${chartInfoUrl}"...\n`);
    const chartResp = await fetch(chartInfoUrl, { headers });
    if (!chartResp.ok) {
      process.stderr.write("Download of chart information failed.\n");
      process.stderr.write((await chartResp.buffer()).toString());
      process.exit(710);
    }
    return await chartResp.json();
  }

  public InitHelmChart = async (cb: () => Promise<void>) => {
    const reqFileLoc = `${this.helmProps.chartLocation}/requirements.yaml`;
    if (!fs.existsSync(reqFileLoc)) {
      process.stderr.write("No requirements found.\n");
      await this.BuildHelmPackages(cb);
    } else {
      process.stderr.write("Requirements found. Adding repositories...\n");
      const reqLocation = path.resolve(`${this.helmProps.chartLocation}/requirements.yaml`);
      const repoRegex = new RegExp(
        /(https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/);
      const helmRepositories: IHelmRepository[] = [];
      lineReader.eachLine(reqLocation, async (line, last) => {
        const matchedGroups = line.match(repoRegex);
        if (matchedGroups) {
          process.stderr.write(`Repo ${matchedGroups[0]} needs to be added. Checking name...\n`);
          const nameRegex = new RegExp(/\/\/([^\.]*)/);
          const name = matchedGroups[0].match(nameRegex);
          const repoExists = helmRepositories.some((repo) => name ? repo.name === name[1] : false);
          if (name && !repoExists) {
            helmRepositories.push({
              name: name[1],
              repository: matchedGroups[0],
            });
          } else {
            if (repoExists) {
              process.stderr.write(`Repo ${matchedGroups[0]} already found...\n`);
            } else {
              process.stderr.write(`Can't capture name from repo: ${matchedGroups[0]}...\n`);
            }
          }
        }
        if (last) {
          await this.AddRepository(helmRepositories, cb);
        }
      });
    }
  }

  public CreateHelmPackage = async (cb: () => void)  => {
    process.stderr.write("Running \"helm package\"...\n");
    const helmPackageCmd = ["helm", "package", "--destination", this.helmProps.tempDirectory.path];
    if (this.request.params.sign === true) {
      const keyData = this.request.params.key_data;
      let keyFile = this.request.params.key_file;
      let keyId: string;
      if (keyData == null && keyFile == null) {
        process.stderr.write("Either key_data or key_file must be specified, when 'sign' is set to true.");
        process.exit(332);
      }
      if (keyData != null) {
        keyFile = path.resolve(this.helmProps.tempDirectory.path, "gpg-key.asc");
        await writeFile(keyFile, keyData);
      }
      const gpgHome: string = path.resolve(await mkdtemp(path.resolve(os.tmpdir(), "concourse-gpg-keyring-")));
      process.stderr.write(`Using new empty temporary GNUPGHOME: "${gpgHome}".\n`);
      try {
        process.stderr.write(`Importing GPG private key: "${keyFile}"...\n`);
        try {
          keyId = await importGpgKey(gpgHome, keyFile as string, this.request.params.key_passphrase);
        } catch (e) {
          process.stderr.write(`Importing of GPG key "${keyFile}" failed.\n`);
          throw e;
        }
        process.stderr.write(`GPG key imported successfully. Key ID: "${keyId}".\n`);
        helmPackageCmd.push("--sign");
        helmPackageCmd.push("--key");
        helmPackageCmd.push(keyId);
        helmPackageCmd.push("--keyring");
        helmPackageCmd.push(`"${path.resolve(gpgHome, "secring.gpg")}"`);
      } catch (e) {
        process.stderr.write("Signing of chart with GPG private key failed\n");
        throw e;
      } finally {
        process.stderr.write(`Removing temporary GNUPGHOME "${gpgHome}".\n`);
        await deltree(gpgHome);
      }
    }
    if (this.helmProps.chartVersion != null) {
      helmPackageCmd.push("--version", this.helmProps.chartVersion);
    }
    if (this.helmProps.appVersion != null) {
      helmPackageCmd.push("--app-version", this.helmProps.appVersion);
    }
    helmPackageCmd.push(this.helmProps.chartLocation);
    child_process.execSync(helmPackageCmd.join(" "));
    cb();
  }

  public CheckPackageExists = async (chartFile: string): Promise<boolean> => {
    process.stderr.write(`Inspecting chart file: "${chartFile}"...\n`);
    try {
      const result = await execSync(`helm inspect ${chartFile}`);
      if (result.stderr != null && result.stderr.length > 0) {
        process.stderr.write(`${result.stderr}\n`);
      }
      const inspectionResult = result.stdout;
      const versionLine = inspectionResult.split(/\r?\n/).find((line) => line.startsWith("version:"));
      if (versionLine == null) {
        process.stderr.write("Unable to parse version information from Helm Chart inspection result.\n");
        process.exit(121);
      } else {
        this.helmProps.chartVersion = versionLine.split(/version:\s*/)[1];
      }
      return true;
    } catch (e) {
      process.stderr.write(`Unable to "inspect" Helm Chart file: ${chartFile}.\n`);
      throw(e);
    }
  }

  public BuildHelmPackages = async (cb: () => void) => {
    const helmBuildCmd = ["helm", "dep", "build", this.helmProps.chartLocation];
    process.stderr.write("Running \"helm dep build\"...\n");
    child_process.execSync(helmBuildCmd.join(" "))
    await this.CreateHelmPackage(cb);
  }

  private AddRepository = async (repositories: IHelmRepository[], cb: () => void) => {
    repositories.forEach((repo) => {
      process.stderr.write(`Adding repo with name: ${repo.name}...\n`);
      const helmRepoAdd = ["helm", "repo", "add", repo.name, repo.repository];
      child_process.execSync(helmRepoAdd.join(" "));
    });
    await this.BuildHelmPackages(cb);
  }

  private UpdateVersion = (): string => {
    const chartInfo = yaml.load(path.resolve(this.helmProps.chartLocation, "Chart.yaml"));
    return chartInfo.version;
  }
}

const importGpgKey = async (gpgHome: string, keyFile: string, passphrase?: string): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    let importResult = "";
    const importProcess = child_process.spawn("gpg", [
      "--batch",
      "--homedir",
      `"${path.resolve(gpgHome)}"`,
      "--import",
      `"${path.resolve(keyFile)}"`,
    ]);
    if (passphrase != null) {
      importProcess.stdin.write(passphrase);
    }
    importProcess.stdin.end();
    importProcess.stderr.on("data", (data) => {
      importResult += data;
    });
    importProcess.stdout.on("data", (data) => {
      process.stderr.write(data);
    });
    importProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`gpg import returned exit code ${code}.`));
      } else {
        const keyIdLine = importResult.split(/\r?\n/).find((line) => line.includes("secret key imported"));
        if (keyIdLine == null) {
          reject("Unable to determine Key ID after successful import: Line with key ID not found.");
        } else {
          const match = /^gpg\:\ key\ (.*?)\: secret\ key\ imported$/.exec(keyIdLine);
          if (match == null) {
            reject("Unable to determine Key ID after successful import: Regex match failure.");
          } else {
            resolve(match[1]);
          }
        }
      }
    });
  });
};
