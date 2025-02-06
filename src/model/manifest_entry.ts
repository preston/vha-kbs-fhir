// Author: Preston Lee

import { InteroperabilityStandard } from "./InteroperabilityStandard";

export class ManifestEntry {
    file: string = '';
    title: string = '';
    description: string = '';
    tags: string[] = [];
    identifiers: Array<{system: string, value: string}> = [];
    standard: InteroperabilityStandard = InteroperabilityStandard.FHIR;
}
