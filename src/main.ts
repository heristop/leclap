import { compile, loadConfig } from '.';
import fs from 'node:fs/promises';
import path from 'node:path';

const configFilePath = globalThis.process.argv[2];

async function main(configFilePath: string): Promise<string | null> {
  try {
    // Load the template descriptor
    const templateDescriptor = await loadConfig(`${configFilePath}`);

    // Get absolute paths for proper configuration
    const cwd = process.cwd();
    const buildDir = path.resolve(cwd, 'build');
    const assetsDir = path.resolve(cwd, 'src/shared/assets');

    // Ensure build directory exists
    await fs.mkdir(buildDir, { recursive: true });

    // Set up configuration similar to the server implementation
    const projectConfig = {
      buildDir, // Use absolute path
      assetsDir, // Use absolute path
      fields: {
        form_1_firstname: 'Emily',
        form_1_lastname: 'Parker',
        form_1_job: 'Frontend Developer',
        form_2_keyword1: 'php',
        form_2_keyword2: 'javascript',
        form_2_keyword3: 'typescript',
        form_2_keyword4: 'caffeine',
      },
    };

    // Call the compilation function
    return await compile(projectConfig, templateDescriptor);
  } catch (error) {
    console.error('Error in main function:', error);
    process.exit(1);
  }
}

if (configFilePath) {
  (async () => {
    try {
      const result = await main(configFilePath);
      if (result) {
        console.log(`Compilation successful: ${result}`);
      } else {
        console.error('Compilation failed to produce output');
        process.exit(1);
      }
    } catch (error) {
      // Handle errors
      if (error instanceof Error) {
        console.error(error.name + ':', error.message);
        if (error.stack) console.error(error.stack);
      } else {
        console.error('Unknown error:', String(error));
      }
      process.exit(1);
    }
  })();
}

export { main };
