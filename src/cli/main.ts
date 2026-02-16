#!/usr/bin/env node

import { parseArgs, helpText } from './args.ts'

const VERSION = '0.1.0'

function main(): void {
  const result = parseArgs(process.argv.slice(2))

  if (!result.ok) {
    console.error(`Error: ${result.error.message}`)
    process.exit(1)
  }

  const command = result.command

  switch (command.kind) {
    case 'help':
      console.log(helpText())
      break
    case 'version':
      console.log(`hal ${VERSION}`)
      break
    case 'build':
      console.log(`hal build: not implemented (file: ${command.file})`)
      break
    case 'test':
      console.log('hal test: not implemented')
      break
    case 'interface':
      console.log(`hal interface: not implemented (file: ${command.file})`)
      break
  }
}

main()
