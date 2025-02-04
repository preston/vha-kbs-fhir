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
  .option('-d, --dry-run', 'Perform a dry run without uploading any resources')
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

function generateKnartMetadata(files: string[], relativeTo: string = process.cwd()): ManifestEntry[] {
  const all: ManifestEntry[] = [];
  files.forEach((file) => {
    // console.log(`Processing file: ${file}`);
    const raw = fs.readFileSync(file);
    const $ = cheerio.loadBuffer(raw);
    const meta = new ManifestEntry();
    meta.standard = 'knart';
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
    meta.standard = 'fhir';
    meta.file = path.relative(relativeTo, file);
    meta.title = JSONPath.JSONPath({ path: '$.resourceType', json }) as string;
    JSONPath.JSONPath({ path: '$..resource.identifier', json }).forEach((ids: any[]) => {
      ids.forEach((id) => {
        meta.identifiers.push({ system: id.system, value: id.value });
        console.log(id);
      });
    });
    all.push(meta);
  });
  return all;
}

program.parse(process.argv);

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
