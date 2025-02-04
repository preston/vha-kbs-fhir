# FHIR Resources, CQL Libraries, Knowledge Artifacts (KNARTS), and Utilities for Veterans Health Administration, Knowledge Based Systems

This repository contains computable clinical knowledge assets and utilities for supporting FHIR and CQL (Clinical Quality Language) capabilities in standards-focused healthcare infrastructures. Command-line utilities are written in TypeScript. Developers may download this library as a standalone utility via NPM, or integrate it into Node-based services to build CDS services or user-level applications. It contains experimental:

* FHIR R4 resources representing CDS concepts such as order sets and questionnaires.
* CQL (Clinical Quality Language) libraries with executable support logic such as conditional expressions and data queries.
* The `vha-kbs-fhir` command-line utility for loading the above into your own FHIR R4 resource server.
* Legacy KNART XML documents used by VHA KBS from 2021 and prior.

This repository does NOT contain:

Authoritative clinical narrative documents used to create these files, such as VA clinical whitepapers, clinical best practice documents, peer reviewed literature, nor other not intended to be directly computable.

## Important Safety and Legal Statements

THE CONTENT OF THIS REPOSITORY MAY CAUSE HARM IF APPLIED AS-IS. IT SHOULD BE REVIEWED AND REVISED BY YOUR LOCAL CLINICAL EXPERTS PRIOR TO PRODUCTION USE. WORK IS MADE AVAILABLE WITHOUT ANY WARRANTY WHATSOEVER, AND WITHOUT CLAIMS, EXPRESSED OR IMPLIED, OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.

# Static Content Only

If you are primarily interested in accessing the content.. TODO

## Pre-Built Images

We have created ready-to-run default content images for your convenience, complete with manifest files. To access the manifest and all content locally using Docker Desktop or other container runtime:

```sh
docker run -it -p 8080:80 --rm --name vha-kbs-fhir p3000/vha-kbs-fhir:latest
```
Open http://localhost:8080 for an index.

## Building Your Own Images

```sh
# Multi-architecture builds
docker buildx build --platform linux/arm64,linux/amd64 -t p3000/vha-kbs-fhir:latest .
# Only your local CPU architecture
docker build -t p3000/vha-kbs-fhir:latest .

```

# Command-Line Interface (CLI) Utilities

## Loading CDS resources into a FHIR server

TODO

## Loading synthetic veteran records

TODO

## Resetting the data environment

TODO

# License

Provided under the Apache 2.0 license by the U.S. Department of Veterans Affairs, Veterans Health Administration
