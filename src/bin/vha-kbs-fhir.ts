#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

import { program } from 'commander';
import axios from 'axios';
import * as cheerio from 'cheerio';

import { VhaKbsFhirVersion } from '../version';
import { Metadata } from '../metadata';

let dryRun = false;
let verbose = false

const cli = program.version(VhaKbsFhirVersion.VERSION)
  .description('CLI tool for managing CQL files as FHIR resources by the ASU SHARES team.');


cli.command('metadata-extract')
  .description('Extract metadata from .xml files assumed to be valid KNART documents.')
  .argument('<directory>', 'Directory with Synthea-generate "fhir" resource files')
  .argument('<knart.json>', 'Output metadata file to create')
  .option('-d, --dry-run', 'Perform a dry run without uploading any resources')
  .option('-v, --verbose', 'Enable verbose logging')
  .action((directory, target, options) => {
    dryRun = options.dryRun;
    if (dryRun) {
      console.log('Dry run enabled. Nothing will be created or modified.');
    }
    verbose = options.verbose;
    const sDirectory = safeFliePathFor(directory);
    glob(`${sDirectory}/**/*.xml`).then((files) => {
      let data = generateKnartMetadata(files, path.dirname(target));
      if (!dryRun) {
        fs.writeFileSync(target, JSON.stringify(data, null, 2));
        console.log('Wrote', data.length, 'entries to', target);        
      }
      // console.log(data);
    });

  });

function generateKnartMetadata(files: string[], relativeTo: string = process.cwd()): Metadata[] {
  const all: Metadata[] = [];
  files.forEach((file) => {
    // console.log(`Processing file: ${file}`);
    const raw = fs.readFileSync(file);
    const $ = cheerio.loadBuffer(raw);
    const meta = new Metadata();
    meta.standard = 'knart';
    meta.file = path.relative(relativeTo, file);
    meta.title = $('title').attr('value') || '';
    $('identifiers identifier').each((i, elem) => {
      meta.tags.push(elem.attribs['identifiername']);
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
