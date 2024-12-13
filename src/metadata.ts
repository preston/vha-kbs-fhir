// Author: Preston Lee

export class Metadata {
    file: string = '';
    title: string = '';
    description: string = '';
    tags: string[] = [];
    standard: 'knart' | 'fhir' = 'fhir';
}
