import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const testsDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const projectRoot = resolve(testsDirectory, '..')

export function readProjectFile(relativePath) {
  return readFile(resolve(projectRoot, relativePath), 'utf8')
}

export async function readPackage() {
  return JSON.parse(await readProjectFile('package.json'))
}
