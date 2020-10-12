export interface IHarborChartYaml {
  apiVersion: string;
  description: string;
  home: string;
  icon: string;
  name: string;
  version: string;
  appVersion: string;
  maintainers: IHarborChartMaintainer[];
  dependencies: Dependency[];
}

export interface IHarborChartMaintainer {
  name: string;
  email: string;
}

interface Dependency {
    name: string;
    version: string;
    repository: string;
  }
