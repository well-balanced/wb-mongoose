#! /usr/bin/env node

const spawn = require('cross-spawn')
const chalk = require('chalk')
const commander = require('commander')
const path = require('path')

const packageJson = require('./package.json')
let projectName

function init() {
  const program = new commander.Command(packageJson.name)
    .version(packageJson.version)
    .arguments('<project-directory>')
    .usage(`${chalk.green('<project-directory>')} [options]`)
    .action(name => {
      projectName = name
    })
    .on('--help', () => {
      console.log(`    Only ${chalk.green('<project-directory>')} is required.`)
      console.log()
    })
    .parse(process.argv)
  const root = path.resolve(projectName)
  const appName = path.basename(root)

  if (typeof projectName === 'undefined') {
    guideProjectSpecification(program)
    process.exit(1)
  }

  runCommand('git', ['clone', packageJson.repository.url, projectName])
    .then(() => {
      return runCommand('rm', ['-rf', `${projectName}/.git`])
    })
    .then(() => {
      return executeNodeScript(
        {
          cwd: process.cwd(),
          args: [],
        },
        [root, appName],
        `
      const packageJson = require('./${appName}/package.json');
      packageJson.name = '${appName}'
      fs.writeFileSync(
        path.join(packageJson.name, 'package.json'),
        JSON.stringify(packageJson, null, 2) + os.EOL,
      );
    `,
      )
    })
    .then(() => {
      console.log('⏳ Installing deps ⏳')
      return runCommand('npm', ['install'], {
        cwd: `${process.cwd()}/${projectName}`,
      })
    })
    .then(() => {
      console.log('😄 setup is successfully completed 😄')
      console.log('run commands')
      console.log(chalk.green(`$ cd ${projectName} && npm run dev`))
    })
    .catch(e => {
      console.log(e)
    })
}

function runCommand(command, args, options = undefined) {
  const spawned = spawn(command, args, options)

  return new Promise(resolve => {
    spawned.stdout.on('data', data => {
      console.log(data.toString())
    })

    spawned.stderr.on('data', data => {
      console.error(data.toString())
    })

    spawned.on('close', () => {
      resolve()
    })
  })
}

init()

function guideProjectSpecification(program) {
  console.error('😂 Please specify the project directory:')
  console.log(
    `👉  ${chalk.cyan('npx ' + program.name())} ${chalk.green(
      '<project-directory>',
    )}`,
  )
  console.log()
  console.log('For example 🤔')
  console.log(
    `👉  ${chalk.cyan('npx ' + program.name())} ${chalk.green('my-app')}`,
  )
  console.log()
  console.log(
    `Run ${chalk.cyan(`${program.name()} --help`)} to see all options 🤡`,
  )
}

function executeNodeScript({ cwd, args }, data, source) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [...args, '-e', source, '--', JSON.stringify(data)],
      { cwd, stdio: 'inherit' },
    )

    child.on('close', code => {
      if (code !== 0) {
        reject({
          command: `node ${args.join(' ')}`,
        })
        return
      }
      resolve()
    })
  })
}
