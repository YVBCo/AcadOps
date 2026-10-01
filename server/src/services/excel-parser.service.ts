import ExcelJS from 'exceljs';

interface ColumnMapping {
    usnColumn: string;      // e.g., "A"
    marksColumn: string;    // e.g., "C"
    courseColumns?: string[];  // For multi-course uploads
}

interface ParsedMarksData {
    metadata?: {
        batch?: string;
        department?: string;
        semester?: number;
    };
    columnMapping: ColumnMapping;
    entries: MarksEntry[];
    sampleRows: MarksEntry[];  // First 3 rows for user confirmation
}

interface MarksEntry {
    usn: string;
    marks: number;              // Raw marks from Excel (out of 100)
    convertedMarks: number;     // Converted to /50
    courseCode?: string;
    courseName?: string;
}

class ExcelParserService {
    // Flexible pattern: at least 3 alphanumeric chars (may include hyphens), case-insensitive
    private readonly USN_PATTERN = /^[0-9A-Za-z][0-9A-Za-z\-]{2,19}$/;

    /**
     * Convert column index (1-based) to Excel column letter (A, B, ..., Z, AA, etc.)
     */
    private colIndexToLetter(colIndex: number): string {
        let result = '';
        let idx = colIndex;
        while (idx > 0) {
            const mod = (idx - 1) % 26;
            result = String.fromCharCode(65 + mod) + result;
            idx = Math.floor((idx - 1) / 26);
        }
        return result;
    }

    /**
     * Convert Excel column letter to 1-based index
     */
    private colLetterToIndex(letter: string): number {
        let result = 0;
        for (let i = 0; i < letter.length; i++) {
            result = result * 26 + (letter.charCodeAt(i) - 64);
        }
        return result;
    }

    /**
     * Parse marks sheet and auto-detect columns
     */
    async parseMarksSheet(fileBuffer: Buffer): Promise<ParsedMarksData> {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(fileBuffer as unknown as ArrayBuffer);
        const worksheet = workbook.worksheets[0];

        if (!worksheet) {
            throw new Error('No worksheet found in the Excel file');
        }

        // Convert worksheet to 2D array for easier processing
        const data: any[][] = [];
        worksheet.eachRow({ includeEmpty: false }, (row: ExcelJS.Row, _rowNumber: number) => {
            const rowData: any[] = [];
            row.eachCell({ includeEmpty: true }, (cell: ExcelJS.Cell, colNumber: number) => {
                // Expand array to handle sparse columns
                while (rowData.length < colNumber) {
                    rowData.push(null);
                }
                rowData[colNumber - 1] = cell.value;
            });
            data.push(rowData);
        });

        // Detect column mapping
        const columnMapping = this.detectColumns(data);

        // Extract metadata if present
        const metadata = this.extractMetadata(data);

        // Parse entries using detected columns
        const entries = this.parseEntries(data, columnMapping);

        return {
            metadata,
            columnMapping,
            entries,
            sampleRows: entries.slice(0, 3),
        };
    }

    /**
     * Smart column detection
     * Looks for USN pattern and numeric marks columns
     */
    private detectColumns(data: any[][]): ColumnMapping {
        const headerRow = this.findHeaderRow(data);
        let usnColumn: string | null = null;
        let marksColumn: string | null = null;
        let usnColIndex: number = -1;

        // Check first few rows to identify USN and marks columns
        for (let rowIndex = headerRow; rowIndex < Math.min(headerRow + 10, data.length); rowIndex++) {
            const row = data[rowIndex];

            for (let colIndex = 0; colIndex < row.length; colIndex++) {
                const cellValue = row[colIndex];
                const columnLetter = this.colIndexToLetter(colIndex + 1);

                // Check if this looks like a USN column
                if (!usnColumn && this.isUSN(cellValue)) {
                    usnColumn = columnLetter;
                    usnColIndex = colIndex;
                }

                // Check if this looks like a marks column (numeric, typically 0-100)
                if (!marksColumn && usnColumn && colIndex > usnColIndex) {
                    if (this.isMarks(cellValue)) {
                        marksColumn = columnLetter;
                    }
                }
            }

            if (usnColumn && marksColumn) break;
        }

        if (!usnColumn || !marksColumn) {
            throw new Error('Could not auto-detect USN or marks columns');
        }

        return {
            usnColumn,
            marksColumn,
        };
    }

    /**
     * Find the row where actual data starts (skip headers/metadata)
     */
    private findHeaderRow(data: any[][]): number {
        for (let i = 0; i < Math.min(10, data.length); i++) {
            const row = data[i];
            // Look for row with USN-like value
            for (const cell of row) {
                if (this.isUSN(cell)) {
                    return i;
                }
            }
        }
        return 0; // Default to first row
    }

    /**
     * Check if a value matches USN pattern (handles strings and numbers from Excel)
     */
    private isUSN(value: any): boolean {
        if (value == null) return false;
        const str = String(value).trim();
        if (str.length < 3) return false;
        return this.USN_PATTERN.test(str);
    }

    /**
     * Check if a value looks like marks (numeric, 0-100)
     */
    private isMarks(value: any): boolean {
        if (typeof value === 'number') {
            return value >= 0 && value <= 100;
        }
        if (typeof value === 'string') {
            const num = parseFloat(value);
            return !isNaN(num) && num >= 0 && num <= 100;
        }
        return false;
    }

    /**
     * Extract metadata from Excel (batch, dept, semester if present)
     */
    private extractMetadata(data: any[][]): any {
        const metadata: any = {};

        // Look in first few rows for metadata patterns
        for (let i = 0; i < Math.min(5, data.length); i++) {
            const row = data[i];
            for (let j = 0; j < row.length - 1; j++) {
                const label = String(row[j] ?? '').toLowerCase();
                const value = row[j + 1];

                if (label.includes('batch') || label.includes('year')) {
                    metadata.batch = String(value);
                }
                if (label.includes('department') || label.includes('dept')) {
                    metadata.department = String(value);
                }
                if (label.includes('semester') || label.includes('sem')) {
                    metadata.semester = parseInt(String(value));
                }
            }
        }

        return metadata;
    }

    /**
     * Parse entries using detected column mapping
     */
    private parseEntries(data: any[][], columnMapping: ColumnMapping): MarksEntry[] {
        const entries: MarksEntry[] = [];
        const usnColIndex = this.colLetterToIndex(columnMapping.usnColumn) - 1;
        const marksColIndex = this.colLetterToIndex(columnMapping.marksColumn) - 1;
        const startRow = this.findHeaderRow(data);

        for (let i = startRow; i < data.length; i++) {
            const row = data[i];
            const rawUsn = row[usnColIndex];
            const marksRaw = row[marksColIndex];

            // Skip if not a valid entry
            if (!this.isUSN(rawUsn) || !this.isMarks(marksRaw)) continue;

            const usn = String(rawUsn).trim().toUpperCase(); // Normalize to uppercase
            const marks = parseFloat(String(marksRaw));
            const convertedMarks = this.convertMarks(marks);

            entries.push({
                usn,
                marks,
                convertedMarks,
            });
        }

        return entries;
    }

    /**
     * Convert marks from /100 to /50 with proper rounding
     * .5 and above rounds UP
     */
    convertMarks(marksOutOf100: number): number {
        const converted = marksOutOf100 / 2;
        // Math.round() rounds .5 up, which is what we want
        return Math.round(converted);
    }
}

export const excelParserService = new ExcelParserService();
export type { ParsedMarksData, MarksEntry, ColumnMapping };
