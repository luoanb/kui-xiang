import { readFileSync } from 'fs';
import { dirname, join } from 'path';

// Mock the parseFrontMatter method from team.js
function parseFrontMatter(content) {
  // Normalize line endings to handle both Windows and Unix formats
  const normalizedContent = content.replace(/\r\n/g, '\n')
  const lines = normalizedContent.split('\n')
  if (lines.length < 3 || lines[0].trim() !== '---') {
    return null
  }

  const frontMatterEnd = lines.indexOf('---', 1)
  if (frontMatterEnd === -1) {
    return null
  }

  const frontMatterLines = lines.slice(1, frontMatterEnd)
  const bodyLines = lines.slice(frontMatterEnd + 1)
  const body = bodyLines.join('\n').trim()

  const result = {
    name: '',
    desc: '',
    team_division: '',
    body
  }

  for (const line of frontMatterLines) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const key = line.slice(0, colonIndex).trim()
    const value = line.slice(colonIndex + 1).trim()

    if (key === 'desc') {
      result.desc = value
    } else if (key === 'name') {
      result.name = value
    } else if (key === 'team-division' || key === 'teamDivision') {
      result.team_division = value
    }
  }

  return result
}

// Test the fix with the actual file content
const filePath = "D:\\workspace\\new-start\\.kui-xiang\\team\\Prompt工程师.md";

try {
  const content = readFileSync(filePath, 'utf8');
  console.log('File content read successfully');
  console.log('First 3 lines:', JSON.stringify(content.split('\n').slice(0, 10)));
  
  // Debug the parseFrontMatter function
  const lines = content.split('\n');
  console.log('\nDebug parseFrontMatter:');
  console.log('Lines length:', lines.length);
  console.log('First line:', JSON.stringify(lines[0].trim()));
  console.log('First line is ---:', lines[0].trim() === '---');
  
  if (lines[0].trim() === '---') {
    const frontMatterEnd = lines.indexOf('---', 1);
    console.log('Front matter end index:', frontMatterEnd);
    if (frontMatterEnd !== -1) {
      console.log('Front matter lines:', lines.slice(1, frontMatterEnd));
    }
  }
  
  const result = parseFrontMatter(content);
  
  if (result) {
    console.log('\nParsing successful!');
    console.log('Name:', result.name);
    console.log('Desc:', result.desc);
    console.log('Team Division:', result.team_division);
    console.log('Body preview:', result.body.substring(0, 100) + '...');
  } else {
    console.log('\nParsing failed!');
  }
} catch (error) {
  console.error('Error reading file:', error);
}