export interface IHarborChartJSON {
    metadata: IMetadata;
    dependencies: any[];
    values: IValues;
    files: IFiles;
    security: ISecurity;
    labels: any[];
  }

interface ISecurity {
  signature: ISignature;
}

interface ISignature {
  signed: boolean;
  prov_file: string;
}

interface IFiles {
  "values.yaml": string;
}

interface IValues {
  "fullnameOverride": string;
  "image.pullPolicy": string;
  "image.repository": string;
  "image.tag": string;
  "ingress.annotations.kubernetes.io/ingress.class": string;
  "ingress.annotations.nginx.ingress.kubernetes.io/whitelist-source-range": string;
  "ingress.enabled": boolean;
  "ingress.hosts": IIngressHost[];
  "ingress.tls": any[];
  "nameOverride": string;
  "nodeSelector.role": string;
  "replicaCount": number;
  "service.port": number;
  "service.type": string;
}

interface IIngressHost {
  host: string;
  paths: string[];
}

interface IMetadata {
    name: string;
    version: string;
    description: string;
    apiVersion: string;
    appVersion: string;
    urls: string[];
    created: string;
    digest: string;
  }
