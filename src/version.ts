// Author: Preston Lee

import path from 'path';
import fs from 'fs';

export class VhaKbsFhirVersion {
    public static VERSION: string = JSON.parse(fs.readFileSync(path.normalize(__dirname + path.sep + '..' + path.sep + 'package.json')).toString()).version;
}