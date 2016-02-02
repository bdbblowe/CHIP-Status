/**
 * Autor: Mario Pérez Esteso <mario@geekytheory.com>
 * Web: geekytheory.com
 * Adapted for CHIP by Helgasoft   Jan 2015
 * TODO:  
 *   Uptime is delayed by a minute, should show up at once
 */
var port = 8000;
var app = require('http').createServer(handler).listen(port, "0.0.0.0"),
  io = require('socket.io').listen(app),  //, { log: false }),
  fs = require('fs'),
  sys = require('util'),
  exec = require('child_process').exec,
  child, child1;
  //io.set('log level', 1);	//reduce log output, replaced with DEBUG=
var connectCounter = 0;
//Escuchamos en el puerto $port
app.listen(port);
//Si todo va bien al abrir el navegador, cargaremos el archivo index.html
function handler(req, res) {
	fs.readFile(__dirname+'/index.html', function(err, data) {
		if (err) {
      //Si hay error, mandaremos un mensaje de error 500
			console.log(err);
			res.writeHead(500);
			return res.end('Error loading index.html');
		}
		res.writeHead(200);
		res.end(data);
	});
}

//Cuando abramos el navegador estableceremos una conexión con socket.io.
//Cada X segundos mandaremos a la gráfica un nuevo valor. 
io.sockets.on('connection', function(socket) {
  var memTotal = 0, memUsed = 0, memFree = 0, memBuffered = 0, memCached = 0, sendData = 1, percentBuffered, percentCached, percentUsed, percentFree;
  var address = socket.handshake.address;

  console.log("New connection from " + address.address + ":" + address.port);
  connectCounter++; 
  console.log("NUMBER OF CONNECTIONS++: "+connectCounter);
  socket.on('disconnect', function() { connectCounter--;  console.log("NUMBER OF CONNECTIONS--: "+connectCounter);});

  // Function for checking memory
    child = exec("egrep 'MemTotal' /proc/meminfo | egrep '[0-9.]{4,}' -o", function (error, stdout, stderr) {
    if (error !== null) {
      console.log('memoryTotal exec error: ' + error);
    } else {
      memTotal = parseInt(stdout);
      socket.emit('memoryTotal', memTotal); 
    }
  });

    child = exec("hostname", function (error, stdout, stderr) {
    if (error !== null) {
      console.log('hostname exec error: ' + error);
    } else {
      socket.emit('hostname', stdout); 
    }
  });

    child = exec("uname -r", function (error, stdout, stderr) {
    if (error !== null) {
      console.log('kernel exec error: ' + error);
    } else {
      socket.emit('kernel', stdout); 
    }
  });  

  setInterval(function(){
    // Function for checking memory free and used  "cat /proc/meminfo"
    child1 = exec("egrep 'MemFree' /proc/meminfo | egrep '[0-9.]{4,}' -o", function (error, stdout, stderr) {
    if (error == null) {
      memFree = parseInt(stdout);
      memUsed = memTotal-memFree;
      percentUsed = Math.round(memUsed*100/ memTotal);
      percentFree = 100 - percentUsed;
    } else {
      sendData = 0;
      console.log('MemFree exec error: ' + error);
    }
  });

    // Function for checking memory buffered
    child1 = exec("egrep 'Buffers' /proc/meminfo | egrep '[0-9.]{1,}' -o", function (error, stdout, stderr) {
    if (error == null) {
      memBuffered = parseInt(stdout);
      //if (isNaN(memBuffered)) memBuffered=0
      percentBuffered = Math.round(memBuffered * 100 / memTotal);
    } else {
      sendData = 0;
      console.log('Buffers exec error: ' + error);
    }
  });

    // Function for checking memory buffered
    child1 = exec("egrep 'Cached' /proc/meminfo | egrep '[0-9.]{4,}' -o", function (error, stdout, stderr) {
    if (error == null) {
      memCached = parseInt(stdout);
      percentCached = Math.round(memCached*100/ memTotal);
    } else {
      sendData = 0;
      console.log('Cached exec error: ' + error);
    }
  });

    if (sendData == 1) {
      socket.emit('memoryUpdate', percentFree, percentUsed, percentBuffered, percentCached); 
    } else {
      sendData = 1;
    }
  }, 5000);

  // Function for measuring temperature
  setInterval(function(){
    child = exec("lsb=$(i2cget -y -f 0 0x34 0x5f); msb=$(i2cget -y -f 0 0x34 0x5e); bin=$(( $(($msb << 4)) | $(($lsb & 0x0F)))); echo $bin", function (error, stdout, stderr) {
    if (error !== null) {
      console.log('temperatureUpdate exec error: ' + error);
    } else {
      //Es necesario mandar el tiempo (eje X) y un valor de temperatura (eje Y).
      var time = new Date().getTime();
      var temp = parseFloat(stdout)/10 - 144.7;	  // in Celsius
      socket.emit('temperatureUpdate', time, temp); 
    }
  });}, 5000);

  setInterval(function(){
    child = exec("top -d 0.5 -b -n2 | grep 'Cpu(s)'|tail -n 1 | awk '{print $2 + $4}'", function (error, stdout, stderr) {
    if (error !== null) {
      console.log('cpuUsageUpdate exec error: ' + error);
    } else {
      //Es necesario mandar el tiempo (eje X) y un valor de temperatura (eje Y).
      var time = new Date().getTime();
      socket.emit('cpuUsageUpdate', time, parseFloat(stdout)); 
    }
  });}, 10000);

	// Uptime
  setInterval(function(){
    child = exec("uptime", function (error, stdout, stderr) {  // | awk '{print $3}' |  rev | cut -c 2- | rev
	    if (error !== null) {
	      console.log('uptime exec error: ' + error);
	    } else {
	      // uptime returns a string "10:42:27 up 1 day,  2:10,  3 users,  load average: 2.12, 1.44, 1.38"
	      var juptime = stdout.substring(stdout.lastIndexOf("up")+3, stdout.lastIndexOf("users")); 
	      juptime = juptime.substr(0, juptime.length-5);
	      socket.emit('uptime', juptime); 
	    }
	  });}, 60000);

// TOP list
  setInterval(function(){
    child = exec("ps aux --width 30 --sort -pcpu --no-headers | head  | awk '{print $11}'", function (error, stdout, stderr) {
	    if (error !== null) {
	      console.log('toplist exec error: ' + error);
	    } else {
	      socket.emit('toplist', stdout); 
	    }
	  });}, 10000);
});
