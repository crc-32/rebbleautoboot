var url = "pebble-4.4.2.apk";
var active = false;

function setStatus(text) {
    document.getElementById("installBtn").textContent = text;
}

function arrayBufferToString(buffer){
    var arr = new Uint8Array(buffer);
    var str = String.fromCharCode.apply(String, arr);
    if(/[\u0080-\uffff]/.test(str)){
        throw new Error("this string seems to contain (still encoded) multibytes");
    }
    return str;
}

async function doBoot() {
    if (active) return; else active = true;
    var bootUrl;
    try {
        bootUrl = new URL(document.getElementById("boot").value);
    } catch (e) {
        console.log(e);
        setStatus("Invalid boot URL");
        active = false;
    }

    setStatus("Connecting...");
    var webusb = await Adb.open("WebUSB");
    try {
        if (webusb.isAdb()) {
            adb = await webusb.connectAdb("host::", () => {
                setStatus("Check phone...");
            });

            setStatus("Connected.");
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);
            xhr.responseType = 'arraybuffer';
            xhr.addEventListener('load', async () => {
                if (xhr.status === 200){
                    var sync = await adb.sync();
                    var fSize = -1;
                    await sync.push(new Blob([xhr.response]), "/sdcard/pebble.apk", 33279, (count, size) => {
                        setStatus(`Uploading ${Math.round(count/size*100)}%`);
                        fSize = size;
                    });
                    await sync.quit();

                    setStatus("Installing...");
                    var install = await adb.shell(`cat /sdcard/pebble.apk | pm install -S ${fSize}`);
                    console.log(arrayBufferToString((await install.receive()).data.buffer));

                    setStatus("Setting up app");
                    var boot = await adb.shell(`am start -a android.intent.action.VIEW -d "${bootUrl.toString()}" com.getpebble.android.basalt`);
                    console.log(arrayBufferToString((await boot.receive()).data.buffer));
                    setStatus("Complete!")
                }else {
                    setStatus("Failed");
                    active = false;
                }
            });

            try {
                xhr.send();
            } catch (e) {
                setStatus("Failed");
                console.log(e);
                active = false;
            }
        }else {
            setStatus("Failed");
            active = false;
        }
    } catch (e) {
        console.log(e);
        setStatus("Failed");
        active = false;
    }
}