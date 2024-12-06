'use client'

import { useState, useEffect, useRef } from "react";
import SerialManager from "@/lib/serial-manager";
import Clock from "@/components/clock";
import LastReading from "@/components/last-reading";
import SerialInterface from "@/components/serial-interface";
import EventLog from "@/components/event-log";
import Pose from "@/components/current-pose";
import dynamic from "next/dynamic";
const ThreeDView = dynamic(() => import("@/components/3d-view"), { ssr: false });

export default function Home() {
  const [ serialManager, setSerialManager ] = useState(null);
  const [ isConnected, setIsConnected ] = useState(false);
  const [ serialInfo, setSerialInfo ] = useState("");
  const [ lastReading, setLastReading] = useState({});
  const posesRef = useRef([ {
    "qr": 0, "qi": 0, "qj": 0, "qk": 0,
    "ax": 0, "ay": 0, "az": 0,
    "vx": 0, "vy": 0, "vz": 0,
    "x": 0, "y": 0, "z": 0,
  } ]);
  const [ eventLog, setEventLog ] = useState([]);

  function onPacketRecv(pobj) {
    switch (pobj.ptype) {
      case 0:
        setLastReading(pobj);
        posesRef.current.push(calculatePose(pobj));
        break;
      case 1:
        setEventLog(prev => [ ...prev, pobj ]);
        break;
    }
  }

  function clamp(value, threshold = 1e-3) {
    return Math.abs(value) < threshold ? 0 : value;
  }

  function calculatePose(pobj) {
    const att = {};
    att.ts = pobj.rx_ts;
    att.qr = pobj.qr;
    att.qi = pobj.qi;
    att.qj = pobj.qj;
    att.qk = pobj.qk;
    att.ax = clamp(pobj.az);
    att.ay = clamp(pobj.ay);
    att.az = clamp(pobj.ax);
    let lastPose = posesRef.current[posesRef.current.length - 1];
    if (!lastPose.ts) lastPose.ts = att.ts;
    let dt = (att.ts - lastPose.ts) / 1000.0;
    console.log('dt:', dt);
    att.vx = clamp(lastPose.vx + att.ax * dt);
    att.vy = clamp(lastPose.vy + att.ay * dt);
    att.vz = clamp(lastPose.vz + att.az * dt);
    att.x = lastPose.x + att.vx * dt;
    att.y = lastPose.y + att.vy * dt;
    att.z = lastPose.z + att.vz * dt;
    if (att.z <= 0) {
      att.z = 0;
      att.vz = 0;
    }
    return att;
  }

  useEffect(() => {
    const manager = new SerialManager(onPacketRecv, setIsConnected, setSerialInfo);
    setSerialManager(manager);
    return () => {
      manager?.disconnect();
    };
  }, []);

  return (
    <div>
      <Clock 
        posx={240} posy={10} 
        width={425} height={85} 
      />
      <SerialInterface 
        isConnected={isConnected} 
        connect={async () => await serialManager?.connect()} 
        disconnect={async () => await serialManager?.disconnect()}
        serialInfo={serialInfo}
        posx={10} posy={10} 
        width={220} height={180} 
      />
      <LastReading 
        reading={lastReading} 
        posx={10} posy={200} 
        width={220} height={640}
      />
      <ThreeDView 
        posesRef={posesRef}
        posx={240} posy={105}
        width={760} height={555}
      />
      <EventLog
        eventLog={eventLog}
        posx={240} posy={670}
        width={375} height={170} />
      <Pose
        posesRef={posesRef}
        posx={625} posy={670}
        width={375} height={170}
      />
    </div>
  );
}

