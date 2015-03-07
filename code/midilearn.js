autowatch = 1;
inlets = 1;


var midilearnobjs = [];
var midiobjects = [];
var mididevices = [];
var toggleList = {};

// these are the two maps which are persisted to disk
var controlList = {};
var midiRouter = {};

// is the shift key down
var shift = false;

// is logging enabled
var logenabled = 0;

// constants
var padding = 2;
var colorAssigned = [0.590803, 1., 0.102193, 0.65];
var colorNotAssinged = [1.0, 0.023504, 0.64687, 0.55];


/****************************************************************
 Message Handlers 
 ****************************************************************/
 
function init() {

	clear_midilearnobjs();

	controlList = {};
	midiRouter = {};
	mididevices = [];
	midiobjects = [];

	readmidimap();
}

function logging(val) {
	logenabled = val;
}

function assignedcolor(r,g,b,a) {
	colorAssigned = [r,g,b,a];
	logmsg("assigned color = " + JSON.stringify(colorAssigned));
}

function unassignedcolor(r,g,b,a) {
	colorNotAssinged = [r,g,b,a];
	logmsg("unassigned color = " + JSON.stringify(colorNotAssinged));
}

function shiftkey(val) {
	shift = (val == 1);
}

function mididevice(name) {
	mididevices.push(name);
}

function togglelistener(name, val) {
	toggleList[name] = val;

	// check to see if control is already assigned
	if (val == 1) {
		var ub = controlList[name].ub;
		ub.message("hltcolor", isassigned(name) ? colorAssigned : colorNotAssinged);
	}
	if (val == 0 && shift) {
		unassign(name);
	}
}

function learnmode(val) {
	if (val == 0) {
		learnmodeoff();
	} else {
		learnmodedeep();
	}
}

function ctlassign(device, chan, cc, val) {

	var needupdate = false;
	if (arguments.length > 0) {
		for (key in toggleList) {
			if (toggleList.hasOwnProperty(key)) {
				var item = toggleList[key];
				if (item === 1) {

					var midi = {
						"device": device,
						"channel": chan,
						"cc": cc
					}

					if (!controlList[key].midi) {
						controlList[key].midi = [];
					}

					controlList[key].midi.push(midi);

					var chanStr = "c-" + chan;
					var ccStr = "cc-" + cc;

					if (!midiRouter[device]) {
						midiRouter[device] = {};
					}
					if (!midiRouter[device][chanStr]) {
						midiRouter[device][chanStr] = {};
					}

					if (!midiRouter[device][chanStr][ccStr]) {
						midiRouter[device][chanStr][ccStr] = [];
					}

					var objArray = midiRouter[device][chanStr][ccStr];

					if (objArray.indexOf(key) === -1) {

						// support multiple assignments per midi control - just because someone might want to
						midiRouter[device][chanStr][ccStr].push(key);

						// lets turn learn-mode hilite off for this control once we get an assignment
						var ub = controlList[key].ub;
						if (ub) {
							ub.message("bang");
						}
						needupdate = true;
					}
				}
			}
		}
	}

	if (needupdate) {
		writemidimap();
	}
}

function routemidi(device, chan, cc, val) {

	var chanStr = "c-" + chan;
	var ccStr = "cc-" + cc;
	if (midiRouter[device].hasOwnProperty(chanStr) && midiRouter[device][chanStr].hasOwnProperty(ccStr)) {

		var objList = midiRouter[device][chanStr][ccStr];
		if (objList) {
			for (var i = 0; i < objList.length; i++) {
				// calling getnameddeep seems to crash max if called to frequently/quickly.... wtf?
				var task = new Task(routeMidiTask, this, objList[i], val);
				task.schedule((i + 1) * 20);
			}
		}
	}
}


function midimode(val) {
	if (val) {
		midion();
	}
	else {
		midioff();
	}
}


function clientlist(name) {
	if (name !== "done") {
		if (!controlList[name]) {
			controlList[name] = {};
		}
		toggleList[name] = 0;
	}
}


/****************************************************************
 workers
 ****************************************************************/

function midion() {

	logmsg("creating midi objects");
	for (var i = 0; i < mididevices.length; i++) {
		var x = 100 + 250 * i;
		var y = 100;

		var gate = this.patcher.getnamed("prepgate");

		// can't figure out how to make a string out of a name with spaces that prepend can understand
		// so we will replace spaces in MIDI device names with delimiter 
		var device = mididevices[i].replace(/\s+/g, "$");

		logmsg("midi in device found: " + device);

		var cin = this.patcher.newdefault(x, y, "ctlin");
		cin.message(mididevices[i]);

		var midichan = this.patcher.newdefault(x, y + 15, "prepend", "set");
		var tbi = this.patcher.newdefault(x, y + 25, "trigger", "b", "i");
		var pack = this.patcher.newdefault(x, y + 50, "pack", 1, 1, 1);

		this.patcher.connect(cin, 0, tbi, 0);
		this.patcher.connect(cin, 1, pack, 1);
		this.patcher.connect(cin, 2, midichan, 0);
		this.patcher.connect(tbi, 1, pack, 2);
		this.patcher.connect(tbi, 0, pack, 0);
		this.patcher.connect(midichan, 0, pack, 0);

		var prep = this.patcher.newdefault(x, y + 100, "prepend", device);
		this.patcher.connect(pack, 0, prep, 0);

		var msg = this.patcher.newdefault(x, y + 150, "message");
		this.patcher.connect(prep, 0, msg, 1);
		this.patcher.connect(prep, 0, gate, 1);
		midiobjects.push([cin, midichan, tbi, pack, prep, msg]);

		if (!midiRouter[device])
			midiRouter[device] = {};
	}
}


function midioff() {

	logmsg("cleaning up midi objects");
	if (midiobjects.length) {
		for (var i = 0; i < midiobjects.length; i++) {
			var objlist = midiobjects[i];
			for (var k = 0; k < objlist.length; k++) {
				this.patcher.remove(objlist[k]);
			}
		}
	}
}


function routeMidiTask(objname, val) {

	//wtf... this crashes max if called too frequently so we have to move to a js task
	var obj = getnameddeep(objname);
	var thispatcher = obj.patcher;
	// if it is a m4l object - then we can just send it a normalized value
	// and it will scale accordingly ( I whidh max objects did the same)
	if (obj.understands("rawfloat")) {
		obj.message("rawfloat", val / 127.0);
	}
	else if (obj.maxclass === "live.togle") {
		obj.message("int", val > 63 ? 1 : 0);
	} else {
		var maxclass = obj.maxclass;

		// are we dealing with a live. object
		if (maxclass.indexOf("live.") > -1) {
			obj.message("float", val / 127.0);
		}
		// if not, lets try to find the min/max values so we can scale accordingly
		else {
			var min = obj.getattr("min");
			var range = obj.getattr("size");
			var n = min + ((val / 127.0) * range);
			obj.message("float", n);
		}
	}
}


function learnmodedeep() {

	logmsg("learn mode deep ON");
	if (controlList) {
		for (key in controlList) {
			if (controlList.hasOwnProperty(key)) {
				var name = key;
				var mobj = getnameddeep(name);
				var assigned = false;
				var clickSender = null;
				var togSender = null;
				if (mobj) {
					var r = mobj.rect;
					var x, y, w, h;

					var thispatcher = mobj.patcher;

					x = r[0];
					y = r[1];
					w = r[2] - r[0];
					h = r[3] - r[1];

					togSender = thispatcher.newdefault(x, r[2] + 75, "send", "toglstnr");
					clickSender = thispatcher.newdefault(x + 25, r[2] + 25, "send", "clicklstnr");

					var ub = thispatcher.newdefault(x, y, "ubutton",
						"@varname", "learn-" + name,
						"@presentation_rect", x - padding, y - padding, w + padding * 2, h + padding * 2,
						"@orderfront", 1,
						"@hltcolor", isassigned(key) ? colorAssigned : colorNotAssinged,
						"@toggle", 1,
						"@presentation", 1,
						"@ignoreclick", 0);

					var tg = thispatcher.newdefault(r[0], r[2] + 25, "toggle",
						"@ignoreclick:", 1);

					var prep = thispatcher.newdefault(r[0], r[2] + 50, "prepend", name);

					thispatcher.connect(ub, 0, tg, 0);
					thispatcher.connect(ub, 1, tg, 0);
					thispatcher.connect(tg, 0, prep, 0);
					thispatcher.connect(prep, 0, togSender, 0);
					thispatcher.connect(ub, 0, clickSender, 0);

					midilearnobjs.push([ub, tg, prep, togSender, clickSender]);
					controlList[key].ub = ub;
				} else {
					logmsg("could not find obj named " + name);
				}

			}
		}
	}
}

function unassign(objName) {

	var midiList = controlList[objName].midi;
	var needupate = false;

	if (midiList) {

		while(midiList.length > 0) {
			var midi = midiList[0];
			var device = midi.device;
			var chanStr = "c-" + midi.channel;
			var ccStr = "cc-" + midi.cc;

			var itemList = midiRouter[device][chanStr][ccStr];
			if (itemList) {
				var ind = itemList.indexOf(objName);
				if (ind > -1) {
					itemList.splice(ind, 1);
				}
			}
			midiList.splice(0, 1);
			needupdate = true;
		}
	}
	if (needupdate) {
		writemidimap();
	}
}

function learnmodeoff() {
	logmsg("midi learn mode OFF");
	clear_midilearnobjs();
	toggleList = {};
}

function clear_midilearnobjs() {

	logmsg("cleaning up learn-mode objects");
	if (midilearnobjs && midilearnobjs.length > 0) {
		for (var i = 0; i < midilearnobjs.length; i++) {
			var items = midilearnobjs[i];
			for (var k = 0; k < items.length; k++) {
				var thispatcher = items[k].patcher;

				thispatcher.remove(items[k]);
			}
		}
	}
	midilearnobjs = [];
}


function writemidimap() {

	var f = new File("midimap.json", "write", "TEXT");

	if (f.isopen) {
		f.position = 0;
		f.eof = 0;
		logmsg("writing midimap.json - parent folder = " + f.foldername);
		f.writestring(JSON.stringify(midiRouter));
		f.close();
	}

	f = new File("controllist.json", "write", "TEXT");
	if (f.isopen) {
		f.position = 0;
		f.eof = 0;
		logmsg("writing controllist.json - parent folder = " + f.foldername);
		f.writestring(JSON.stringify(controlList));
		f.close();
	}
}

function readmidimap() {
	var f = new File("midimap.json", "read");
	if (f.isopen) {
		var size = f.eof;
		var temp = f.readstring(size);
		if (temp) {

			midiRouter = JSON.parse(temp);
			logmsg("loaded midimap successfully: " + JSON.stringify(midiRouter));
		}
	}
	f = new File("controllist.json", "read");
	if (f.isopen) {
		var size = f.eof;
		var temp = f.readstring(size);
		if (temp) {
			controlList = JSON.parse(temp);
			logmsg("loaded controlList successfully: " + JSON.stringify(controlList));
		}
	}
}


/****************************************************************
 utils
 ****************************************************************/

function findroot() {
	var thispatcher = this.patcher;
	while (thispatcher.parentpatcher) {
		thispatcher = thispatcher.parentpatcher;
	}
	return thispatcher;
}


function getnameddeep(name) {
	var tree = name.split("::");
	var thispatcher = findroot();
	for (var i = 0; i < tree.length - 1; i++) {
		thispatcher = thispatcher.getnamed(tree[i]).subpatcher();
	}
	return thispatcher.getnamed(tree[tree.length - 1]);
}

function isassigned(name) {
	return (controlList[name].midi && controlList[name].midi.length);
}


function printlists() {
	logmsg("midiRouter = " + JSON.stringify(midiRouter));
	logmsg("controlList = " + JSON.stringify(controlList));
}

function logmsg(msg) {
	if (logenabled) {
		post(msg + "\n");
	}
}