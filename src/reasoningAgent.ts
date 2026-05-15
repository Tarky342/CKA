import * as fs from 'node:fs';
import * as path from 'path';

/**
 * Generate documentation based on knowledge units.
 */
function generateDocumentation(knowledgeUnits: any[], outputPath: string) {
    const documentation = knowledgeUnits.map(unit => {
        return `### ${unit.name}\n\n` +
               `**Type**: ${unit.type}\n\n` +
               `**Parameters**: ${unit.parameters.join(', ')}\n\n` +
               `**Return Type**: ${unit.returnType}\n\n` +
               `**Documentation**: ${unit.documentation || 'N/A'}\n`;
    }).join('\n\n');

    fs.writeFileSync(outputPath, documentation, 'utf-8');
    console.log(`Documentation written to ${outputPath}`);
}

/**
 * Reasoning Agent to process structured knowledge and generate insights.
 */
function processKnowledge(inputPath: string) {
    const knowledgeData = fs.readFileSync(inputPath, 'utf-8')
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));

    console.log('Processing knowledge units...');
    knowledgeData.forEach(unit => {
        console.log(`Processed: ${unit.name}`);
    });

    // Generate documentation
    const outputPath = path.resolve('./output/documentation.md');
    generateDocumentation(knowledgeData, outputPath);
}

// Example usage
const inputPath = './output/knowledge.jsonl';
processKnowledge(inputPath);

// Example usage for portfolio-nfc-main
const portfolioInputPath = './output/portfolio_knowledge.jsonl';
processKnowledge(portfolioInputPath);