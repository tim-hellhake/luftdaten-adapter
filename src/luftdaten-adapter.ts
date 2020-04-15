/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

import { Adapter, Device, Property } from 'gateway-addon';

import fetch from 'node-fetch';

interface Measurement {
  id?: number;
  sensordatavalues?: SensorValue[];
  sensor?: Sensor;
}

interface SensorValue {
  value_type?: string;
  value?: string;
}

interface Sensor {
  sensor_type?: SensorType;
  id?: number;
}

interface SensorType {
  id?: string;
  manufacturer?: string;
  name?: string;
}

class Luftdaten extends Device {
  constructor(adapter: any, id: string, measurement: Measurement) {
    super(adapter, id);
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this.name = measurement?.sensor?.sensor_type?.name || id;

    for (const sensorValue of measurement.sensordatavalues || []) {
      const propertyName = sensorValue.value_type;

      if (propertyName) {
        this.addProperty(propertyName, {
          type: 'number',
          title: propertyName,
          readOnly: true
        });
      }
    }
  }

  public update(measurement: Measurement) {
    for (const sensorValue of measurement.sensordatavalues || []) {
      const propertyName = sensorValue.value_type;

      if (propertyName) {
        const property = this.properties.get(propertyName);

        if (property) {
          if (sensorValue.value) {
            property.setCachedValueAndNotify(sensorValue.value);
          } else {
            console.warn(`Could not find value for property ${propertyName}`);
          }
        } else {
          console.warn(`Could not find property ${propertyName}`);
        }
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

    const {
      pollInterval
    } = this.manifest.moziot.config;

    this.startPolling(pollInterval);
  }

  public startPolling(seconds: number) {
    setInterval(() => this.poll(), seconds * 1000);
    this.poll();
  }

  async poll() {
    const measurements = await this.findSensors();

    for (const measurement of measurements) {
      let id = measurement?.sensor?.id;

      if (id) {
        let device = this.devicesById[id];

        if (!device) {
          const idWithPrefix = `luftdaten-${id}`;
          console.log(`Creating new device for ${idWithPrefix}`);
          device = new Luftdaten(this, idWithPrefix, measurement);
          this.devicesById[id] = device;
          this.handleDeviceAdded(device);
        }

        device.update(measurement);
      }
    }
  }

  async findSensors() {
    const {
      latitude,
      longitude,
      radius
    } = this.manifest.moziot.config;

    const url = `http://api.luftdaten.info/v1/filter/area=${latitude},${longitude},${radius}`;
    const result = await fetch(url);
    return <Measurement[]>await result.json();
  }
}
