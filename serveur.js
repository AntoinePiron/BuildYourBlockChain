#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { Server } from "socket.io";
import { io as ioClient } from "socket.io-client";

// Analyse des paramètres
const argv = yargs(hideBin(process.argv))
  .option("port", {
    alias: "p",
    default: "3000",
    description: "port à utiliser",
  })
  .version("1.0.0")
  .help().argv;

// Création de la DB
const db = Object.create(null);

const neighbors = [];
const sockets = [];

// Initialisation d'une socket
function initSocket(socket) {
  socket.on("get", function (field, callback) {
    if (db.includes(field)) {
      console.info(`get ${field}: ${db[field]?.value}`);
      callback(undefined, db[field]); // lit et renvoie la valeur associée à la clef.
    } else {
      const error = new Error(`Field ${field} not exists`);
      console.error(error);
      callback(error.message);
    }
  });

  socket.on("set", function (field, value, callback) {
    if (value === null || typeof value !== "object") {
      // on modifie la valeur pour en faire un objet
      value = {
        value: value,
        date: Date.now(),
      };
    }
    if (db.includes(field)) {
      if (db[field].value !== value) {
        const error = new Error(`set error : Field ${field} exists.`);
        console.info(error);
        callback(error.message);
      }
    } else {
      console.info(`set ${field} : ${value}`);
      db[field] = {
        value,
        date: Date.now(), // on sauvegarde la date de création
      };
      sockets.forEach((s) =>
        s.emit("set", field, value, (error) => {
          if (error) {
            console.error(error);
          }
        })
      );
      callback();
    }
  });

  socket.on("keys", function (callback) {
    console.info("keys");
    callback(undefined, Object.keys(db)); // Object.keys() extrait la liste des clefs d'un object et les renvoie sous forme d'un tableau.
  });

  socket.on("peers", function (callback) {
    console.info("peers");
    callback(undefined, neighbors);
  });

  socket.on("addPeer", function (peer, callback) {
    console.info("addPeer");
    if (!neighbors.includes(peer)) {
      neighbors.push(peer);
      const sock = ioClient(`http://localhost:${peer}`, {
        path: "/byc",
      });
      sock.on("connect", () => {
        console.info(`Connected to ${peer}`);
        initSocket(sock);
        sockets.push(sock);
        sock.emit("auth", argv.port, (error) => {
          if (error) {
            console.error(error);
          }
        });
        sync(sock);
      });
      callback();
    } else {
      const error = new Error("neighbor exists");
      callback(error.message);
    }
  });

  socket.on("auth", function (peer, callback) {
    console.info("auth");
    if (!neighbors.includes(peer)) {
      neighbors.push(peer);
      sockets.push(socket);
      sync(socket);
    }
    callback();
  });
}

// Création du serveur
const io = new Server(argv.port, {
  path: "/byc",
  serveClient: false,
});

console.info(`Serveur lancé sur le port ${argv.port}.`);

// À chaque nouvelle connexion
io.on("connect", (socket) => {
  console.info("Nouvelle connexion");
  initSocket(socket);
});

function sync(sock) {
  sock.emit("keys", (error, keys) => {
    if (error) {
      console.error("ERROR:", error);
    } else {
      keys.forEach((key) => {
        if (!db.includes(key)) {
          sock.emit("get", key, (error, value) => {
            if (error) {
              console.error("ERROR:", error);
            } else {
              db[key] = value;
              console.info(`sync ${key} : ${value}`);
            }
          });
        }
      });
    }
  });
}
