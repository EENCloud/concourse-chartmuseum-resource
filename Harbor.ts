import * as fs from "fs";
import * as path from "path";
import * as util from "util";
import * as yaml from "yamljs";
import { IHarborChartYaml } from "./types/Harbor";


export const getChartYaml = (chartLocation: string): IHarborChartYaml => {
  return yaml.load(path.resolve(chartLocation, "Chart.yaml"));
};

export const writeChartYaml  = (chartLocation: string, yamlObj: IHarborChartYaml) => {
  const writeFile = util.promisify(fs.writeFile);
  writeFile(path.resolve(chartLocation, "Chart.yaml"), yaml.stringify(yamlObj));
};

export const convertStrVersionToInt = (version: string) => {
  const versionSplit = version.split(".");
  const major = parseInt(versionSplit[0], 10);
  const minor = parseInt(versionSplit[1], 10);
  const patch = parseInt(versionSplit[2], 10);
  return [convertNaNtoZero(major), convertNaNtoZero(minor), convertNaNtoZero(patch)];
};

const convertNaNtoZero = (n: number): number => isNaN(n) ? 0 : n;
