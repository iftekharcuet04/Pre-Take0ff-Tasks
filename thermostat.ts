/*Scenario:
A thermostat controls the temperature and interacts with heaters and coolers. Other parts of the system might read or adjust the temperature. The system should remain reliable even if misused.
Instruction:
Write a class (or module) for the Thermostat.
*/


interface Device {
    on(): void;
    off(): void;
    readonly isOn: boolean;
  }

  class Heater implements Device {
    private _isOn = false;
  
    on(): void {
      if (!this._isOn) {
        this._isOn = true;
        console.log("🔥 Heater ON");
      }
    }
  
    off(): void {
      if (this._isOn) {
        this._isOn = false;
        console.log("🔥 Heater OFF");
      }
    }
  
    get isOn(): boolean {
      return this._isOn;
    }
  }
  
  class Cooler implements Device {
    private _isOn = false;
  
    on(): void {
      if (!this._isOn) {
        this._isOn = true;
        console.log("❄️ Cooler ON");
      }
    }
  
    off(): void {
      if (this._isOn) {
        this._isOn = false;
        console.log("❄️ Cooler OFF");
      }
    }
  
    get isOn(): boolean {
      return this._isOn;
    }
  }

  
  class Thermostat {
    private minTemp: number;
    private maxTemp: number;
    private hysteresis: number;
  
    private currentTemp: number;
    private targetTemp: number;
  
    private heater: Device;
    private cooler: Device;
  
    constructor(
      heater: Device,
      cooler: Device,
      minTemp = 10,
      maxTemp = 30,
      hysteresis = 0.5
    ) {
      this.minTemp = minTemp;
      this.maxTemp = maxTemp;
      this.hysteresis = hysteresis;
  
      this.currentTemp = 20;
      this.targetTemp = 22;
  
      this.heater = heater;
      this.cooler = cooler;
    }
  
    setTargetTemperature(value: number): void {
      this.targetTemp = Math.max(this.minTemp, Math.min(this.maxTemp, value));
      console.log(`🎯 Target temperature set to ${this.targetTemp}°C`);
    }
  
    update(currentTemp: number): void {
      this.currentTemp = currentTemp;
      console.log(`🌡 Current temperature: ${this.currentTemp}°C`);
  
      if (this.currentTemp < this.targetTemp - this.hysteresis) {
        this.cooler.off();
        this.heater.on();
      } else if (this.currentTemp > this.targetTemp + this.hysteresis) {
        this.heater.off();
        this.cooler.on();
      } else {
        this.heater.off();
        this.cooler.off();
      }
    }
  
    getStatus() {
      return {
        currentTemp: this.currentTemp,
        targetTemp: this.targetTemp,
        heaterOn: this.heater.isOn,
        coolerOn: this.cooler.isOn,
      };
    }
  }
  

  const heater = new Heater();
const cooler = new Cooler();

const thermostat = new Thermostat(heater, cooler);

thermostat.setTargetTemperature(25);

thermostat.update(23); // Heater ON
thermostat.update(26); // Cooler ON
thermostat.update(25); // Both OFF
