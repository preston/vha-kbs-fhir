// Author: Preston Lee

export class ManifestEntry {
    file: string = '';
    title: string = '';
    description: string = '';
    tags: string[] = [];
    identifiers: Array<{system: string, value: string}> = [];
    standard: 'knart' | 'fhir' = 'fhir';
}
