// Author: Preston Lee

export class Stack {
    public title: string = 'VHA KBS FHIR Data & Stack Controller';
    public instructions: string = "Load all data files, below, to use VHA KBS' content library and synthetic example patient records and references.";
    public fhir_base_url: string = "http://localhost:8080/fhir";
    public driver: string = "hapi";
    public links: Array<{ name: string, url: string }> = [
        {
            name: "Stack Controller",
            url: "http://localhost:4204"
        }, {
            name: "HAPI FHIR (R5 Mode)",
            url: "http://localhost:8080"
        }];
    public data: Array<{ file: string, load: boolean, name: string, description: string, type: string }> = [
        {
            "file": "data/hospitalInformation1671557337568.json",
            "load": true,
            "name": "Organization Bundle 1",
            "description": "Synthea-generated Organization records",
            "type": "Organization Bundle"
        }];
}