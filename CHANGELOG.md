# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2018-09-04

### Fixed

- `helm init` is now called prior to packaging [#1](https://github.com/cathive/concourse-chartmuseum-resource/issues/1)

### Added

- Support for signing packages using a GPG key has been added.

### Updated

- Node.js runtime has been updated to v10.9.0
- Included Helm binary has been updated to v2.10.0.
- All NPM (dev/runtime) dependencies have been updated to their respective latest versions

### Changed

- The parameter `chart_file` has been renamed to just `chart`.
  It can now either point to a packaged chart (.tgz file) or a directory
  that contains an unpackaged chart.

## [0.2.0] - 2018-01-16

### Added

- `out` resource has been implemented and can be used to directly deploy packaged
  helm charts in .tgz format to a ChartMuseum

### Fixed

- Chart re-deployments are now handled correctly and the `check` action is being triggered
  if only the digest of a chart (and not it's version) has been changed

## [0.1.1] - 2018-01-15

### Fixed

- Updated and enhanced documentation.

## [0.1.0] - 2018-01-14

### Added

- First public version. Implementation of the `check` and `in` actions have been done so far.