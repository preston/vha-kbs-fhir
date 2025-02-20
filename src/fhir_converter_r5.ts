// Author: Preston Lee

import { CheerioAPI } from "cheerio";
import { FhirResource } from "fhir/r5";

export class FhirConverterR5 {

    public knartToFhir(xml: CheerioAPI): FhirResource[] {
        const resources: FhirResource[] = [];
        
        // $('entry').each((i, elem) => {
        //   const resource = $(elem).find('resource');
        //   const id = $(elem).find('id').attr('value');
        //   const type = $(elem).find('type').attr('value');
        //   const title = $(elem).find('title').attr('value');
        //   const jsonResource = {
        //     resourceType: type,
        //     id: id,
        //     title: title,
        //     ...JSON.parse(resource.text())
        //   };
        //   // json.entry.push({
        //   //   resource: jsonResource
        //   // });
        return resources;
    }

}