#!/usr/bin/env node

import fs, { Dir, Dirent } from 'fs';
import path, { dirname } from 'path';
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
import { FhirConverterR5 } from '../fhir_converter_r5';
import { Bundle, BundleEntry } from 'fhir/r5';

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

    const sDirectory = safeFilePathFor(contentDirectory);
    glob(`${sDirectory}/**/*.knart.xml`).then((files) => {
      dataKnart = generateKnartMetadata(files, path.dirname(output));
      // console.log(dataKnart);
      glob(`${sDirectory}/**/*.fhir.json`).then((files) => {
        dataFhir = generateFhirMetadata(files, path.dirname(output));
        if (!dryRun) {
          const dataAll = dataKnart.concat(dataFhir);
          const manifest = new Manifest();
          manifest.entries = dataAll;
          manifest.name = 'VHA KBS Content Library & Synthetic Example Data ';
          fs.writeFileSync(output, JSON.stringify(manifest, null, 2));
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
    const sManifestPath = safeFilePathFor(manifestPath);
    const sStackPath = safeFilePathFor(stackPath);
    const manifest: Manifest = JSON.parse(fs.readFileSync(sManifestPath).toString());
    const stack = new Stack();
    manifest.entries.forEach((entry) => {
      if (entry.standard == InteroperabilityStandard.FHIR) {
        const e = {
          file: entry.file,
          load: true,
          name: entry.title,
          description: entry.description,
          type: entry.standard,
          priority: 10
        };
        applyPriority(e, entry);
        stack.data.push(e);
      }
    });
    fs.writeFileSync(sStackPath, JSON.stringify(stack, null, 2));
    // console.log(manifest);
  });


cli.command('stack-upload')
  .description('Upload a defined of resources in sequence..')
  .argument('<path_to.stack.json>', 'Stack controller configuration file to read')
  // .argument('<url>', 'URL of the FHIR server to upload the resources to')
  .option('-d, --dry-run', 'Perform a dry run without uploading any resources')
  .action((stackPath, fhirUrl, options) => {
    dryRun = options.dryRun;
    if (dryRun) {
      console.log('Dry run enabled. No resources will be uploaded.');
    }
    const sStackFilePath = safeFilePathFor(stackPath);
    const stack: Stack = JSON.parse(fs.readFileSync(sStackFilePath).toString());
    console.log(`Uploading Synthea-generated FHIR resources from ${sStackFilePath} to ${stack.fhir_base_url}`);
    const files = stack.data.filter((e) => e.load).sort((a, b) => a.priority - b.priority);
    uploadResources(stack.data, stack).then(() => {
      console.log('Done');
    });
  });

cli.command('knart-to-fhir')
  .description('Converts a KNART documents to a FHIR resource bundles.')
  .argument('<manifest.json>', 'Input manifest file to read')
  .argument('<output_directory>', 'Output directory to write FHIR resources to')
  .option('-d, --dry-run', 'Perform a dry run without creating or modifying any resources')
  .action((manifestPath, outputDirectory, options) => {
    dryRun = options.dryRun;
    if (dryRun) {
      console.log('Dry run enabled. Nothing will be created or modified.');
    }
    const sManifestPath = safeFilePathFor(manifestPath);
    const sOutputDirectory = safeFilePathFor(outputDirectory);
    const manifest: Manifest = JSON.parse(fs.readFileSync(sManifestPath).toString());
    manifest.entries.forEach((entry) => {
      if (entry.standard == InteroperabilityStandard.KNART) {
        const sFilePath = safeFilePathFor(entry.file);
        // console.log(`Processing ${sFilePath}`);

        const raw = fs.readFileSync(sFilePath);
        const $ = cheerio.loadBuffer(raw);
        const bundle: Bundle = {
          resourceType: 'Bundle',
          type: 'collection',
          entry: []
        };
        const converter = new FhirConverterR5();
        const resources = converter.knartToFhir($);
        resources.forEach((resource) => {
          const entry: BundleEntry = {
            resource: resource
          };
          bundle.entry!.push(entry);
        });
        const outputFileName = path.join(sOutputDirectory, entry.file.replace('.knart.xml', '.fhir.json'));
        if (dryRun) {
          console.log(`Dry run: Would have written ${outputFileName}`);
        } else {
          fs.mkdirSync(path.dirname(outputFileName), { recursive: true });
          fs.writeFileSync(outputFileName, JSON.stringify(bundle, null, 2));
          console.log('Wrote', outputFileName);
        }
      }
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


function safeFilePathFor(fileName: string) {
  let safePath = fileName;
  if (!path.isAbsolute(fileName)) {
    safePath = path.join(process.cwd(), fileName);
  }
  if (verbose) {
    console.debug(`Safe path: ${safePath}`);
  }
  return safePath;
}




async function uploadResources(data: { file: string; load: boolean; name: string; description: string; type: string; priority: number; }[], stack: Stack) {
  let next = data.shift();
  if (next) {
    await uploadResource(next, stack);
    if (data.length > 0) {
      await uploadResources(data, stack);
    }
  }
}

async function uploadResource(data: { file: string; load: boolean; name: string; description: string; type: string; priority: number; }, stack: Stack) {
  // const file = path.join(directory, fileName);
  const raw = fs.readFileSync(data.file).toString();
  const json = JSON.parse(raw) as any;
  // console.log(json);

  if (dryRun) {
    return new Promise<void>((resolve, reject) => {
      console.log(`Dry run: Would have uploaded ${data.file}`);
      resolve();
    });
  } else {
    return axios.post(stack.fhir_base_url, json, {
      headers: {
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json',
      },
    }).then((response) => {
      console.log(`[SUCCESS]: ${response.status} ${response.statusText}`, data.file);
      // console.log('Response Data:', JSON.stringify(response.data, null, 2));
    }).catch((error) => {
      if (error.response) {
        console.error(`[FAILURE]: ${error.response.status} ${error.response.statusText}`, data.file);
        console.error(JSON.stringify(error.response.data, null, 2));
      } else {
        console.error(`[ERROR]: ${error.message}`, data.file);
      }
    });
  }
}

function applyPriority(e: { file: string; load: boolean; name: string; description: string; type: InteroperabilityStandard.FHIR; priority: number; }, entry: ManifestEntry) {
  if (entry.file.match(/hospital.*\.json/)) {
    e.priority = 0;
  } else if (entry.file.match(/practitioner.*\.json/)) {
    e.priority = 1;
  }
}