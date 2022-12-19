/*
ORIGINAL (TypeScript):
https://github.com/k0swe/adif-parser-ts
*/

"use strict";


/* ##################*/
/*  simple-adif.ts   */
//Object.defineProperty(exports, "__esModule", { value: true });
//exports.AdifParser = exports.AdifFormatter = void 0;
/* ##################*/
/*  adif-formatter.ts   */
/**
 * A class for formatting objects into ADIF.
 */
class AdifFormatter {
    /**
     * Format the given object into an ADIF string.
     */
    static formatAdi(obj) {
        return new AdifFormatter(obj).format();
    }
    constructor(obj) {
        this.obj = obj;
    }
    format() {
        // From just a moment of research, string concatenation should have OK
        // performance. Maybe do testing and reconsider.
        let buffer = '';
        if (this.obj.header !== undefined) {
            buffer += this.obj.header.text + '\n';
            const restOfHeader = this.obj.header;
            delete restOfHeader.text;
            buffer += AdifFormatter.formatTags(restOfHeader);
            buffer += '<eoh>\n\n';
        }
        if (!this.obj.records) {
            return AdifFormatter.prepReturn(buffer);
        }
        for (const rec of this.obj.records) {
            buffer += AdifFormatter.formatTags(rec);
            buffer += '<eor>\n\n';
        }
        return AdifFormatter.prepReturn(buffer);
    }
    static formatTags(obj) {
        let buffer = '';
        for (const [key, value] of Object.entries(obj)) {
            const width = new TextEncoder().encode(value).byteLength;
            buffer += `<${key}:${width}>${value}\n`;
        }
        return buffer;
    }
    static prepReturn(buffer) {
        buffer = buffer.trim();
        if (buffer.length === 0) {
            return buffer;
        }
        return buffer + '\n';
    }
}
// exports.AdifFormatter = AdifFormatter;
/* ##################*/
/*  adif-parser.ts   */
/**
 * A class for parsing ADIF data into usable data structures.
 */
class AdifParser {
    /**
     * Parse the given ADIF data string into an object.
     */
    static parseAdi(adi) {
        return new AdifParser(adi).parseTopLevel();
    }
    constructor(adi) {
        this.adi = adi;
        this.cursor = 0;
    }
    parseTopLevel() {
        const parsed = {};
        if (this.adi.length === 0) {
            return parsed;
        }
        // Header
        if (this.adi[0] !== '<') {
            const header = {};
            header['text'] = this.parseHeaderText();
            while (this.cursor < this.adi.length) {
                const endOfHeader = this.parseTagValue(header);
                if (endOfHeader) {
                    break;
                }
            }
            parsed.header = header;
        }
        // QSO Records
        const records = new Array();
        while (this.cursor < this.adi.length) {
            const record = this.parseRecord();
            if (Object.keys(record).length > 0) {
                records.push(record);
            }
        }
        if (records.length > 0) {
            parsed.records = records;
        }
        return parsed;
    }
    parseHeaderText() {
        const startTag = this.adi.indexOf('<', this.cursor);
        this.cursor = startTag;
        return this.adi.substring(0, startTag).trim();
    }
    parseRecord() {
        const record = {};
        while (this.cursor < this.adi.length) {
            const endOfRecord = this.parseTagValue(record);
            if (endOfRecord) {
                break;
            }
        }
        return record;
    }
    parseTagValue(record) {
        const startTag = this.adi.indexOf('<', this.cursor);
        if (startTag === -1) {
            this.cursor = this.adi.length;
            return true;
        }
        const endTag = this.adi.indexOf('>', startTag);
        const tagParts = this.adi.substring(startTag + 1, endTag).split(':');
        if (tagParts[0].toLowerCase() === 'eor' ||
            tagParts[0].toLowerCase() === 'eoh') {
            this.cursor = endTag + 1;
            return true;
        }
        else if (tagParts.length < 2) {
            if (this.adi.substring(startTag + 1, endTag) === 'APP_LoTW_EOF') {
                this.cursor = endTag + 1;
                return true;
            }
            throw new Error('Encountered field tag without enough parts near char ' +
                startTag +
                ': ' +
                this.adi.substring(startTag + 1, startTag + 80) +
                '\n');
        }
        const fieldName = tagParts[0].toLowerCase();
        const width = +tagParts[1];
        record[fieldName] = this.adi.substr(endTag + 1, width);
        this.cursor = endTag + 1 + width;
        return false;
    }
}
// exports.AdifParser = AdifParser;