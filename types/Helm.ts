export interface IHelm {
  chartLocation: string;
  tempDirectory: {
    path: string;
    cleanupCallback: () => void;
  };
  appVersion: string | undefined;
  chartVersion: string;
}

export interface IHelmRepository {
  name: string;
  repository: string;
}

export interface HelmChart {
  name: string;
  apiVersion: string;
  appVersion: string;
  version: string;
  description: string;
  home: string;
  icon: string;
  sources: string[];
  dependencies: Dependency[];
}
interface Dependency {
  name: string;
  version: string;
  repository: string;
}
