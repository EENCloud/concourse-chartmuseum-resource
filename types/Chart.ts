interface HarborChartJSON {
    metadata: Metadata;
    dependencies: any[];
    values: Values;
    files: Files;
    security: Security;
    labels: any[];
  }

  interface Security {
    signature: Signature;
  }

  interface Signature {
    signed: boolean;
    prov_file: string;
  }

  interface Files {
    'values.yaml': string;
  }

  interface Values {
    fullnameOverride: string;
    'image.pullPolicy': string;
    'image.repository': string;
    'image.tag': string;
    'ingress.annotations.kubernetes.io/ingress.class': string;
    'ingress.annotations.nginx.ingress.kubernetes.io/whitelist-source-range': string;
    'ingress.enabled': boolean;
    'ingress.hosts': Ingresshost[];
    'ingress.tls': any[];
    nameOverride: string;
    'nodeSelector.role': string;
    replicaCount: number;
    'service.port': number;
    'service.type': string;
  }

  interface Ingresshost {
    host: string;
    paths: string[];
  }

  interface Metadata {
    name: string;
    version: string;
    description: string;
    apiVersion: string;
    appVersion: string;
    urls: string[];
    created: string;
    digest: string;
  }
