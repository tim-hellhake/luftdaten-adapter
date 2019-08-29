/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

import { Adapter, Device, Property } from 'gateway-addon';

import fetch from 'node-fetch';

interface Sensor {
  id: number;
  sensordatavalues: SensorValue[]
}

interface SensorValue {
  value_type: string;
  value: string;
}

class Luftdaten extends Device {
  constructor(adapter: any, manifest: any, sensor: Sensor) {
    super(adapter, `luftdaten-${sensor.id}`);
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this.name = `${Luftdaten.name} (${sensor.id})`;
    this.description = manifest.description;

    for (const sensorValue of sensor.sensordatavalues) {
      const propertyName = sensorValue.value_type;

      this.addProperty(propertyName, {
        type: 'number',
        title: propertyName,
        readOnly: true
      });
    }
  }

  public update(sensor: Sensor) {
    for (const sensorValue of sensor.sensordatavalues) {
      const propertyName = sensorValue.value_type;
      const property = this.properties.get(propertyName);

      if (property) {
        if (sensorValue.value) {
          property.setCachedValue(sensorValue.value);
          this.notifyPropertyChanged(property);
        } else {
          console.warn(`Could not find value for property ${propertyName}`);
        }
      } else {
        console.warn(`Could not find property ${propertyName}`);
      }
    }
  }

  private addProperty(name: string, description: any): Property {
    const property = new Property(this, name, description);
    this.properties.set(name, property);
    return property;
  }
}

export class LuftdatenAdapter extends Adapter {
  private devicesById: { [id: number]: Luftdaten } = {};

  constructor(addonManager: any, private manifest: any) {
    super(addonManager, LuftdatenAdapter.name, manifest.name);
    addonManager.addAdapter(this);
    this.startPolling(60);
  }

  public startPolling(seconds: number) {
    setInterval(() => this.poll(), seconds * 1000);
    this.poll();
  }

  async poll() {
    const sensors = await this.findSensors();

    for (const sensor of sensors) {
      let device = this.devicesById[sensor.id] || this.createDevice(sensor);
      device.update(sensor);
    }
  }

  private createDevice(sensor: Sensor): Device {
    const id = sensor.id;
    console.log(`Creating new device for ${id}`);
    const device = new Luftdaten(this, this.manifest, sensor);
    this.devicesById[id] = device;
    this.handleDeviceAdded(device);
    return device;
  }

  async findSensors() {
    const {
      latitude,
      longitude
    } = this.manifest.moziot.config;

    const url = `http://api.luftdaten.info/v1/filter/area=${latitude},${longitude},5`;
    const result = await fetch(url);
    return <Sensor[]>await result.json();
  }
}
