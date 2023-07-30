"use strict";
const Homey = require("homey");
const generatedScreensavers = require("./assets/json/generated-screensavers.json");
const { sleep, getDifference } = require('./lib/helpers');

const _settingsKey = `${Homey.manifest.id}.settings`;

class App extends Homey.App {
  async onInit() {
    try {
        const Homey2023 = this.homey.platformVersion === 2;

        if(!Homey2023) {
            this.log(`${this.homey.manifest.id} - ${this.homey.manifest.version} started...`);
    
            const getLanguage = this.homey.i18n.getLanguage();
    
            this.currentLang = getLanguage === 'nl' ? 'nl' : 'en';
    
            await this.initSettings();
            await this.initScreenSavers();
        } else {
            this.log(`${this.homey.manifest.id} - ${this.homey.manifest.version} not started...`);
    
            await this.homey.notifications.createNotification({
                excerpt: `${this.homey.manifest.name.en} doesn't work on Homey 2023`
            });
        }
    } catch (error) {
        this.log(error)
    }
  }

  async initSettings() {
    try {
      let settingsInitialized = false;
      this.homey.settings.getKeys().forEach((key) => {
        if (key == _settingsKey) {
          settingsInitialized = true;
        }
      });
      

      if (settingsInitialized) {
        this.log("initSettings - Found settings key", _settingsKey);
        this.appSettings = this.homey.settings.get(_settingsKey);

        if(this.appSettings.SCREENSAVERS.length < this.homey.manifest.screensavers.length) {
            this.log(`[InitSettings] - Adding extra screensavers`);
        
            const newScreensavers = [
                ...getDifference(this.appSettings.SCREENSAVERS, this.homey.manifest.screensavers),
                ...getDifference(this.homey.manifest.screensavers, this.appSettings.SCREENSAVERS)
            ];
       
            this.appSettings.SCREENSAVERS = [...this.appSettings.SCREENSAVERS, ...newScreensavers];
            this.log(`[InitSettings] - Added`, newScreensavers);
        }


        this.appSettings = {...this.appSettings, LANGUAGE: this.currentLang};
        this.log(`[InitSettings] - Set language to`, this.currentLang);

        if (this.appSettings) {
          this.saveSettings();
        }

        return;
      }

      this.log(`Initializing ${_settingsKey} with defaults`);
      this.updateSettings({ SCREENSAVERS: this.homey.manifest.screensavers, LANGUAGE: this.currentLang }, false);
    } catch (err) {
      this.error(err);
    }
  }

  updateSettings(settings, restart = true) {
    this.log("updateSettings - New settings:", {...settings, SCREENSAVERS: []});
    console.dir(settings.SCREENSAVERS, {'maxArrayLength': null})
    this.appSettings = settings;
    this.saveSettings();

    if (restart) {
      this.log("Restart the app.");
    }
  }

  saveSettings() {
    if (typeof this.appSettings === "undefined") {
      this.log("Not saving settings; settings empty!");
      return;
    }

    this.log("Saved settings.");
    this.homey.settings.set(_settingsKey, this.appSettings);
  }

  initScreenSavers() {
    this.animations = {};
    generatedScreensavers.sort((a, b) => a.title[this.currentLang].localeCompare(b.title[this.currentLang])).forEach(async (screensaver) => {
      const matchedScreensaver = this.appSettings.SCREENSAVERS.find(
        (s) => s.name === screensaver.id
      );

      if (matchedScreensaver && matchedScreensaver.enabled) {
        this.log(`Create animation: ${screensaver.id}`);
        
        this.animations[`${screensaver.id}`] = await this.homey.ledring.createAnimation(screensaver);

        await sleep(1000);

        this.log(`Registering: ${screensaver.id}`);
        await this.homey.ledring.registerScreensaver(screensaver.id, this.animations[`${screensaver.id}`]);
      }
    });
  }
}

module.exports = App;
