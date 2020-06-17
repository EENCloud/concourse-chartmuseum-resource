FROM node:12.4.0 as builder
RUN apt-get -y update && apt-get -y install curl gzip tar unzip
ARG HELM_DOWNLOAD_URL="https://get.helm.sh/helm-v3.2.4-linux-amd64.tar.gz"
RUN curl -s -j -k -L "${HELM_DOWNLOAD_URL}" > /tmp/helm.tar.gz
RUN echo "8eb56cbb7d0da6b73cd8884c6607982d0be8087027b8ded01d6b2759a72e34b1 /tmp/helm.tar.gz" | sha256sum -c
RUN mkdir -p /data
WORKDIR /data
RUN gunzip -c "/tmp/helm.tar.gz" | tar -xf - \
    && mv "/data/linux-amd64/helm" "/data/helm" \
    && rm -f "/tmp/helm.tar.gz" \
    && rm -rf "/tmp/linux-amd64"
COPY . /src
WORKDIR /src
RUN npm -s install && npm -s run build && npm -s test && npm -s pack && mv eencloud-concourse-harbor-resource-*.tgz /data/eencloud-concourse-harbor-resource.tgz

FROM node:12.4.0-alpine
RUN apk add --no-cache gnupg ca-certificates
COPY --from=builder "/data/helm" "/usr/local/bin/helm"
COPY --from=builder "/data/eencloud-concourse-harbor-resource.tgz" "/tmp/eencloud-concourse-harbor-resource.tgz"
RUN npm -s install -g /tmp/eencloud-concourse-harbor-resource.tgz \
    && rm -f /tmp/eencloud-concourse-harbor-resource.tgz \
    && mkdir -p /opt/resource \
    && ln -sf /usr/local/bin/concourse-harbor-resource-check /opt/resource/check \
    && ln -sf /usr/local/bin/concourse-harbor-resource-in /opt/resource/in \
    && ln -sf /usr/local/bin/concourse-harbor-resource-out /opt/resource/out
ENV PATH="/usr/local/bin:/usr/bin:/bin"
LABEL maintainer="Aaron Layfield <alayfield@een.com>" \
      version="0.8.2" \
      org.concourse-ci.target-version="5.4.0" \
      org.concourse-ci.resource-id="harbor" \
      org.concourse-ci.resource-name="Harbor package management" \
      org.concourse-ci.resource-homepage="https://github.com/eencloud/concourse-harbor-resource"
