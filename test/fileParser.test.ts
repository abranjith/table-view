import * as assert from 'assert';
import { FileParser } from '../src/fileParser';

suite('File Parser Test Suite', () => {
    test('Parse basic File', () => {
        const fileContent = 'Name,Age,City\nJohn,25,New York\nJane,30,Boston';
        const result = FileParser.parse(fileContent);
        
        assert.strictEqual(result.length, 3);
        assert.deepStrictEqual(result[0], ['Name', 'Age', 'City']);
        assert.deepStrictEqual(result[1], ['John', '25', 'New York']);
        assert.deepStrictEqual(result[2], ['Jane', '30', 'Boston']);
    });

    test('Parse File with quoted fields', () => {
        const fileContent = 'Name,Age,City\n"Smith, John",25,"New York, NY"';
        const result = FileParser.parse(fileContent);
        
        assert.strictEqual(result.length, 2);
        assert.deepStrictEqual(result[0], ['Name', 'Age', 'City']);
        assert.deepStrictEqual(result[1], ['Smith, John', '25', 'New York, NY']);
    });

    test('Parse File with escaped quotes', () => {
        const fileContent = 'Name,Quote\nJohn,"He said ""Hello"" to me"';
        const result = FileParser.parse(fileContent);
        
        assert.strictEqual(result.length, 2);
        assert.deepStrictEqual(result[0], ['Name', 'Quote']);
        assert.deepStrictEqual(result[1], ['John', 'He said "Hello" to me']);
    });

    test('Parse File with newlines in quoted fields', () => {
        const fileContent = 'Name,Description\nJohn,"Line 1\nLine 2\nLine 3"';
        const result = FileParser.parse(fileContent);
        
        assert.strictEqual(result.length, 2);
        assert.deepStrictEqual(result[0], ['Name', 'Description']);
        assert.deepStrictEqual(result[1], ['John', 'Line 1\nLine 2\nLine 3']);
    });

    test('Parse File with varying column counts', () => {
        const fileContent = 'A,B,C\n1,2\n3,4,5,6';
        const result = FileParser.parse(fileContent);
        
        assert.strictEqual(result.length, 3);
        // All rows should have 4 columns (the max from any row)
        assert.strictEqual(result[0].length, 4);
        assert.strictEqual(result[1].length, 4);
        assert.strictEqual(result[2].length, 4);
        
        // Check normalization - missing fields should be empty strings
        assert.deepStrictEqual(result[0], ['A', 'B', 'C', '']);
        assert.deepStrictEqual(result[1], ['1', '2', '', '']);
        assert.deepStrictEqual(result[2], ['3', '4', '5', '6']);
    });

    test('Stringify File back to string format', () => {
        const rows = [
            ['Name', 'Age', 'City'],
            ['Smith, John', '25', 'New York'],
            ['Jane', '30', 'He said "Hello"']
        ];
        const result = FileParser.stringify(rows);
        
        const expected = 'Name,Age,City\n"Smith, John",25,New York\nJane,30,"He said ""Hello"""';
        assert.strictEqual(result, expected);
    });

    test('Handle empty File', () => {
        const result = FileParser.parse('');
        assert.strictEqual(result.length, 0);
    });

    test('Handle File with only headers', () => {
        const fileContent = 'Name,Age,City';
        const result = FileParser.parse(fileContent);
        
        assert.strictEqual(result.length, 1);
        assert.deepStrictEqual(result[0], ['Name', 'Age', 'City']);
    });
});
