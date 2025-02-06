#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

import { program } from 'commander';
import axios from 'axios';
import * as cheerio from 'cheerio';
import JSONPath from 'jsonpath-plus';

import { VhaKbsFhirVersion } from '../version';
import { ManifestEntry } from '../model/manifest_entry';
import { Stack } from '../model/stack';
import { Manifest } from '../model/manifest';
import { InteroperabilityStandard } from '../model/InteroperabilityStandard';

let dryRun = false;
let verbose = false

const cli = program.version(VhaKbsFhirVersion.VERSION)
  .description('CLI tool for managing CQL files as FHIR resources by the ASU SHARES team.');

const DEFAULT_CONTENT_DIRECTORY = path.join(__dirname, '..', '..', 'content');

cli.command('metadata-extract')
  .description('Extract metadata from .knart.xml files assumed to be valid KNART documents.')
  // .argument('<directory>', 'Directory with Synthea-generate "fhir" resource files')
  .argument('<path_to_output_manifest.json>', 'Output metadata file to create')
  .option('-c, --content <directory>', 'Directory of your own content instead of included files')
  .option('-d, --dry-run', 'Perform a dry run without creating or modifying any resources')
  .option('-v, --verbose', 'Enable verbose logging')
  .action((output, options) => {
    dryRun = options.dryRun;
    if (dryRun) {
      console.log('Dry run enabled. Nothing will be created or modified.');
    }
    verbose = options.verbose;
    let contentDirectory = DEFAULT_CONTENT_DIRECTORY;
    if (options.content) {
      contentDirectory = options.content;
    }
    let dataKnart: ManifestEntry[] = [];
    let dataFhir: ManifestEntry[] = [];

    const sDirectory = safeFliePathFor(contentDirectory);
    glob(`${sDirectory}/**/*.knart.xml`).then((files) => {
      dataKnart = generateKnartMetadata(files, path.dirname(output));
      // console.log(dataKnart);
      glob(`${sDirectory}/**/*.fhir.json`).then((files) => {
        dataFhir = generateFhirMetadata(files, path.dirname(output));
        if (!dryRun) {
          const dataAll = dataKnart.concat(dataFhir);
          fs.writeFileSync(output, JSON.stringify(dataAll, null, 2));
          console.log('Wrote', dataAll.length, 'entries to', output);
          console.log(' *', dataKnart.length, 'KNART entries');
          console.log(' *', dataFhir.length, 'FHIR entries');
        }
      });
    });

  });

cli.command('stack-create')
  .description('Create a new Stack Controller configuration from a manifest file.')
  .argument('<path_to_input.manifest.json>', 'Input manifest file to read')
  .argument('<path_to_output.stack.json>', 'Output stack controller file to create')
  .option('-d, --dry-run', 'Perform a dry run without creating or modifying any resources')
  .action((manifestPath, stackPath, options) => {
    dryRun = options.dryRun;
    if (dryRun) {
      console.log('Dry run enabled. Nothing will be created or modified.');
    }
    const sManifestPath = safeFliePathFor(manifestPath);
    const sStackPath = safeFliePathFor(stackPath);
    const manifest: Manifest = JSON.parse(fs.readFileSync(sManifestPath).toString());
    const stack = new Stack();
    manifest.entries.forEach((entry) => {
      if (entry.standard == InteroperabilityStandard.FHIR) {
        stack.data.push({
          file: entry.file,
          load: true,
          name: entry.title,
          description: entry.description,
          type: entry.standard,
        });
      }
    });
    fs.writeFileSync(sStackPath, JSON.stringify(stack, null, 2));
    // console.log(manifest);
  });


cli.command('synthea-upload')
  .description('Upload a directory of Synthea-generated FHIR resources to a FHIR URL using Synthea file naming conventions and loading order.')
  .argument('<directory>', 'Directory with Synthea-generate "fhir" resource files')
  .argument('<url>', 'URL of the FHIR server to upload the resources to')
  .option('-d, --dry-run', 'Perform a dry run without uploading any resources')
  .action((directory, fhirUrl, options) => {
    dryRun = options.dryRun;
    if (dryRun) {
      console.log('Dry run enabled. No resources will be uploaded.');
    }
    const sDirectory = safeFliePathFor(directory);
    console.log(`Uploading Synthea-generated FHIR resources from ${sDirectory} to ${fhirUrl}`);
    const files = fs.readdirSync(sDirectory).filter(file => path.extname(file).toLowerCase() === '.json');
    const hospitals: string[] = [];
    const pratitioners: string[] = [];
    const patients: string[] = [];
    files.forEach((file, i) => {
      if (file.startsWith('hospitalInformation')) {
        hospitals.push(file);
      } else if (file.startsWith('practitionerInformation')) {
        pratitioners.push(file);
      } else {
        patients.push(file);
      }
    });
    // const sFiles = files.map((file) => path.join(sDirectory, file));
    uploadResources(hospitals, sDirectory, fhirUrl).then(() => {
      uploadResources(pratitioners, sDirectory, fhirUrl).then(() => {
        uploadResources(patients, sDirectory, fhirUrl).then(() => {
          console.log('Done');
        });
      });
    });
  });

program.parse(process.argv);

function generateKnartMetadata(files: string[], relativeTo: string = process.cwd()): ManifestEntry[] {
  const all: ManifestEntry[] = [];
  files.forEach((file) => {
    // console.log(`Processing file: ${file}`);
    const raw = fs.readFileSync(file);
    const $ = cheerio.loadBuffer(raw);
    const meta = new ManifestEntry();
    meta.standard = InteroperabilityStandard.KNART;
    meta.file = path.relative(relativeTo, file);
    meta.title = $('title').attr('value') || '';
    $('identifiers identifier').each((i, elem) => {
      meta.identifiers.push({ system: elem.attribs['extension'], value: elem.attribs['identifiername'] });
    });
    all.push(meta);
  });
  // console.log(all);
  return all;
}

function generateFhirMetadata(files: string[], relativeTo: string = process.cwd()): ManifestEntry[] {
  const all: ManifestEntry[] = [];
  files.forEach((file) => {
    // console.log(`Processing file: ${file}`);
    const raw = fs.readFileSync(file);
    // const $ = cheerio.loadBuffer(raw);
    const json = JSON.parse(raw.toString());
    const meta = new ManifestEntry();
    meta.standard = InteroperabilityStandard.FHIR;
    meta.file = path.relative(relativeTo, file);
    meta.title = JSONPath.JSONPath({ path: '$.resourceType', json }) as string;
    JSONPath.JSONPath({ path: '$..resource.identifier', json }).forEach((ids: any[]) => {
      ids.forEach((id) => {
        meta.identifiers.push({ system: id.system, value: id.value });
        // console.log(id);
      });
    });
    all.push(meta);
  });
  return all;
}


function safeFliePathFor(fileName: string) {
  let safePath = fileName;
  if (!path.isAbsolute(fileName)) {
    safePath = path.join(process.cwd(), fileName);
  }
  if (verbose) {
    console.debug(`Safe path: ${safePath}`);
  }
  return safePath;
}



async function uploadResources(_paths: string[], directory: string, fhirUrl: string) {
  let next = _paths.shift();
  if (next) {
    await uploadResource(next, directory, fhirUrl);
    if (_paths.length > 0) {
      await uploadResources(_paths, directory, fhirUrl);
    }
  }
}

async function uploadResource(fileName: string, directory: string, fhirUrl: string) {
  const file = path.join(directory, fileName);
  const raw = fs.readFileSync(file).toString();
  const json = JSON.parse(raw) as any;
  // console.log(json);

  if (dryRun) {
    return new Promise<void>((resolve, reject) => {
      console.log(`Dry run: Would have uploaded ${fileName}`);
      resolve();

    });
  } else {
    return axios.post(fhirUrl, json, {
      headers: {
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json',
      },
    }).then((response) => {
      console.log(`[SUCCESS]: ${response.status} ${response.statusText}`, file);
      // console.log('Response Data:', JSON.stringify(response.data, null, 2));
    }).catch((error) => {
      if (error.response) {
        console.error(`[FAILURE]: ${error.response.status} ${error.response.statusText}`, file);
        console.error(JSON.stringify(error.response.data, null, 2));
      } else {
        console.error(`[ERROR]: ${error.message}`, file);
      }
    });
  }
}