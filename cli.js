#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { io } from 'socket.io-client'

const argv = yargs(hideBin(process.argv)) // Analyse des paramètres
  .command('get <key>', 'Récupère la valeur associé à la clé')
  .command('set <key> <value> [timestamp]', 'Place une association clé / valeur')
  .command('keys', 'Demande la liste des clés')
  .command('addPeer <peerPort>', 'Ajoute un nouveau noeud voisin')
  .command('peers', 'Demande la liste des pairs du noeud')
  .command('version', 'Demande la version du CLI')
  .option('url', {
    alias: 'u',
    default: 'http://localhost',
    description: 'Url du serveur à contacter'
  })
  .option('port', {
    alias: 'p',
    default: '3000',
    description: 'port à utiliser'
  })
  .option('bot', {
    alias: 'b',
    default: false,
    description: 'désactive les messages utilisateur'
  })
  .demandCommand(1, 'Vous devez indiquer une commande')
  .help()
  .argv

// Si l'utilisateur demande la verion
if (argv._[0] === 'version') {
  console.log('1.0.0')
  process.exit(0) // met fin au programme
}

function info (msg) {
  if (!argv.bot) {
    console.info(msg)
  }
}

const socket = io(`${argv.url}:${argv.port}`, {
  path: '/byc',
  timeout: 5000,
  reconnection: false,
  requestTimeout: 5000
})

socket.on('error', (error) => {
  console.error('error:', error)
  socket.close()
})

socket.on('reconnect', (error) => {
  console.error('reconnect:', error)
  socket.close()
})

socket.on('reconnect_attempt', (error) => {
  console.error('reconnect:', error)
  socket.close()
})

socket.on('reconnect_error', (error) => {
  console.error('reconnect:', error)
  socket.close()
})

socket.on('reconnect_failed', (error) => {
  console.error('reconnect:', error)
  socket.close()
})

socket.on('connect_error', (error) => {
  console.error('connect_error:', error)
  socket.close()
})

socket.on('disconnect', () => {
  info('Disconnect')
})

socket.on('connect', () => {
  info('Connection établie')

  let id

  // Returns a race between our timeout and the passed in promise
  return Promise.race([
    new Promise((resolve, reject) => {
      id = setTimeout(() => {
        clearTimeout(id)
        socket.close()
        reject(new Error('Le serveur ne répond pas'))
        info('Le serveur ne répond pas...')
      }, 5000)
    }),
    new Promise((resolve, reject) => {
      function end () {
        clearTimeout(id)
        socket.close()
        resolve()
      }

      switch (argv._[0]) {
        case 'get':
          info(`Commande get ${argv.key} =>`)

          socket.emit('get', argv.key, (error, res) => {
            if (error) {
              console.error('ERROR:', error)
            } else {
              console.info(res.value)
            }
            end()
          })
          break
        case 'set':
          info(`set ${argv.key} =>`)

          if (argv.timestamp) {
            socket.emit('set', argv.key, { value: argv.value, date: +(argv.timestamp) }, (error) => {
              if (error) {
                console.error('ERROR:', error)
              } else {
                console.info('OK')
              }
              end()
            })
          } else {
            socket.emit('set', argv.key, argv.value, (error) => {
              if (error) {
                console.error('ERROR:', error)
              } else {
                console.info('OK')
              }
              end()
            })
          }
          break
        case 'keys':
          info('keys =>')

          socket.emit('keys', (error, keys) => {
            if (error) {
              console.error('ERROR:', error)
            } else {
              console.info(keys.join(','))
            }
            end()
          })
          break
        case 'keysAndTime':
          if (!argv.bot) {
            console.info('keysAndTime =>')
          }
          socket.emit('keysAndTime', (error, keys) => {
            if (error) {
              console.error('ERROR:', error)
            } else {
              console.info(keys)
            }
            end()
          })
          break
        case 'addPeer':
          info(`addPeer ${argv.peerPort} =>`)

          socket.emit('addPeer', argv.peerPort, (error) => {
            if (error) {
              console.error('ERROR:', error)
            } else {
              console.info('OK')
            }
            end()
          })
          break
        case 'peers':
          info('peers =>')

          socket.emit('peers', (error, peers) => {
            if (error) {
              console.error('ERROR:', error)
            } else {
              console.info(peers.join(','))
            }
            end()
          })
          break
        default:
          console.error('Commande inconnue')
          end()
      }
    })
  ])
})
