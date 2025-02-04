// Author: Preston Lee

import { ManifestEntry } from "./manifest_entry";

export class Manifest {
    public name: string = '';
    public updated_at: string = new Date().toISOString();
    public entries: ManifestEntry[] = [];
}