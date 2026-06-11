"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  MCP_COMMANDS: () => MCP_COMMANDS,
  activate: () => activate
});
module.exports = __toCommonJS(extension_exports);

// node_modules/@ableton-extensions/sdk/dist/index.mjs
var DataModelObject = class DataModelObject2 {
  /** @internal */
  constructor(handle, dataModel, objectRegistry) {
    this.handle = handle;
    this.dataModel = dataModel;
    this.objectRegistry = objectRegistry;
  }
  /** The canonical parent of this object in Live's object hierarchy, or `null` if it has none. */
  get parent() {
    const handle = this.dataModel.getObjectCanonicalParent(this.handle);
    return handle ? this.objectRegistry.getObjectFromHandle(handle, DataModelObject2) : null;
  }
};
var invokeAsync = (dataModel, fn, ...args) => new Promise((resolve, reject) => {
  dataModel.withinTransaction(() => fn(...args, resolve, reject));
});
var createAsync = (dataModel, registry, type, fn, ...args) => new Promise((resolve, reject) => {
  dataModel.withinTransaction(() => fn(...args, (handle) => resolve(registry.getObjectFromHandle(handle, type)), reject));
});
var Clip = class extends DataModelObject {
  static className = "Clip";
  get name() {
    return this.dataModel.clipGetName(this.handle);
  }
  set name(name) {
    this.dataModel.withinTransaction(() => {
      this.dataModel.clipSetName(this.handle, name);
    });
  }
  get startTime() {
    return this.dataModel.clipGetStartTime(this.handle);
  }
  get endTime() {
    return this.dataModel.clipGetEndTime(this.handle);
  }
  get duration() {
    return this.dataModel.clipGetEndTime(this.handle) - this.dataModel.clipGetStartTime(this.handle);
  }
  get startMarker() {
    return this.dataModel.clipGetStartMarker(this.handle);
  }
  get endMarker() {
    return this.dataModel.clipGetEndMarker(this.handle);
  }
  /**
  * Whether the clip is looped. Enabling looping on an unwarped audio clip
  * automatically enables warping.
  */
  get looping() {
    return this.dataModel.clipGetLooping(this.handle);
  }
  set looping(value) {
    this.dataModel.withinTransaction(() => {
      this.dataModel.clipSetLooping(this.handle, value);
    });
  }
  get loopStart() {
    return this.dataModel.clipGetLoopStart(this.handle);
  }
  get loopEnd() {
    return this.dataModel.clipGetLoopEnd(this.handle);
  }
  get color() {
    return this.dataModel.clipGetColor(this.handle);
  }
  set color(value) {
    this.dataModel.withinTransaction(() => {
      this.dataModel.clipSetColor(this.handle, value);
    });
  }
  get muted() {
    return this.dataModel.clipGetMuted(this.handle);
  }
  set muted(value) {
    this.dataModel.withinTransaction(() => {
      this.dataModel.clipSetMuted(this.handle, value);
    });
  }
};
var AudioClip = class extends Clip {
  static className = "AudioClip";
  get filePath() {
    return this.dataModel.audioclipGetFilePath(this.handle);
  }
  get warping() {
    return this.dataModel.audioclipGetWarping(this.handle);
  }
  set warping(value) {
    this.dataModel.withinTransaction(() => {
      this.dataModel.audioclipSetWarping(this.handle, value);
    });
  }
  get warpMode() {
    return this.dataModel.audioclipGetWarpMode(this.handle);
  }
  set warpMode(warpMode) {
    this.dataModel.withinTransaction(() => {
      this.dataModel.audioclipSetWarpMode(this.handle, warpMode);
    });
  }
  get warpMarkers() {
    return this.dataModel.audioclipGetWarpMarkers(this.handle);
  }
};
var MidiClip = class extends Clip {
  static className = "MidiClip";
  get notes() {
    return this.dataModel.midiclipGetNotes(this.handle);
  }
  set notes(notes) {
    this.dataModel.withinTransaction(() => {
      this.dataModel.midiclipSetNotes(this.handle, notes);
    });
  }
};
var ClipSlot = class extends DataModelObject {
  static className = "ClipSlot";
  get clip() {
    const handle = this.dataModel.clipslotGetClip(this.handle);
    return handle ? this.objectRegistry.getObjectFromHandle(handle, Clip) : null;
  }
  /**
  * Deletes the clip in this slot. Await the returned promise to ensure the
  * deletion has been fully processed.
  */
  deleteClip() {
    return invokeAsync(this.dataModel, this.dataModel.clipslotDeleteClip, this.handle);
  }
  /** @param length - Length of the clip in beats. */
  createMidiClip(length) {
    return createAsync(this.dataModel, this.objectRegistry, MidiClip, this.dataModel.clipslotCreateMidiClip, this.handle, length);
  }
  /**
  * Creates an audio clip in this session slot.
  *
  * @param args.filePath - Absolute path to the audio file.
  * @param args.isWarped - See {@link AudioTrack.createAudioClip}.
  * @param args.loopSettings - See {@link AudioTrack.createAudioClip}.
  */
  createAudioClip(args) {
    return createAsync(this.dataModel, this.objectRegistry, AudioClip, this.dataModel.clipslotCreateAudioClip, this.handle, {
      filePath: args.filePath,
      isWarped: args.isWarped,
      loopSettings: args.loopSettings
    });
  }
};
var DeviceParameter = class extends DataModelObject {
  static className = "DeviceParameter";
  get name() {
    return this.dataModel.deviceParameterGetName(this.handle);
  }
  get min() {
    return this.dataModel.deviceParameterGetInternalMin(this.handle);
  }
  get max() {
    return this.dataModel.deviceParameterGetInternalMax(this.handle);
  }
  get isQuantized() {
    return this.dataModel.deviceParameterGetIsQuantized(this.handle);
  }
  get defaultValue() {
    return this.dataModel.deviceParameterGetDefaultValue(this.handle);
  }
  get valueItems() {
    return this.dataModel.deviceParameterGetValueItems(this.handle);
  }
  getValue() {
    return new Promise((resolve) => {
      this.dataModel.deviceParameterGetInternalValue(this.handle, resolve);
    });
  }
  setValue(value) {
    return new Promise((resolve, reject) => {
      this.dataModel.withinTransaction(() => {
        this.dataModel.deviceParameterSetInternalValue(this.handle, value, resolve, (error) => reject(new Error(error)));
      });
    });
  }
};
var Device = class extends DataModelObject {
  static className = "Device";
  get name() {
    return this.dataModel.deviceGetName(this.handle);
  }
  get parameters() {
    return this.dataModel.deviceGetParameters(this.handle).map((handle) => this.objectRegistry.getObjectFromHandle(handle, DeviceParameter));
  }
};
var TakeLane = class extends DataModelObject {
  static className = "TakeLane";
  get clips() {
    return this.dataModel.takelaneGetClips(this.handle).map((handle) => this.objectRegistry.getObjectFromHandle(handle, Clip));
  }
  get name() {
    return this.dataModel.takelaneGetName(this.handle);
  }
  set name(value) {
    this.dataModel.withinTransaction(() => {
      this.dataModel.takelaneSetName(this.handle, value);
    });
  }
  /**
  * @param startTime - Position in the arrangement in beats.
  * @param duration - Length of the clip in beats.
  */
  createMidiClip(startTime, duration) {
    return createAsync(this.dataModel, this.objectRegistry, MidiClip, this.dataModel.takelaneCreateMidiClip, this.handle, startTime, duration);
  }
  /**
  * Creates an audio clip on this take lane. See {@link AudioTrack.createAudioClip}
  * for argument semantics.
  */
  createAudioClip(args) {
    return createAsync(this.dataModel, this.objectRegistry, AudioClip, this.dataModel.takelaneCreateAudioClip, this.handle, {
      duration: args.duration,
      filePath: args.filePath,
      isWarped: args.isWarped,
      loopSettings: args.loopSettings,
      startTime: args.startTime
    });
  }
};
var TrackMixer = class extends DataModelObject {
  static className = "MixerDevice";
  get volume() {
    return this.objectRegistry.getObjectFromHandle(this.dataModel.mixerdeviceGetVolume(this.handle), DeviceParameter);
  }
  get panning() {
    return this.objectRegistry.getObjectFromHandle(this.dataModel.mixerdeviceGetPanning(this.handle), DeviceParameter);
  }
  get sends() {
    return this.dataModel.mixerdeviceGetSends(this.handle).map((handle) => this.objectRegistry.getObjectFromHandle(handle, DeviceParameter));
  }
};
var Track = class Track2 extends DataModelObject {
  static className = "Track";
  get name() {
    return this.dataModel.trackGetName(this.handle);
  }
  set name(value) {
    this.dataModel.withinTransaction(() => {
      this.dataModel.trackSetName(this.handle, value);
    });
  }
  get mute() {
    return this.dataModel.trackGetMute(this.handle);
  }
  set mute(value) {
    this.dataModel.withinTransaction(() => {
      this.dataModel.trackSetMute(this.handle, value);
    });
  }
  get solo() {
    return this.dataModel.trackGetSolo(this.handle);
  }
  set solo(value) {
    this.dataModel.withinTransaction(() => {
      this.dataModel.trackSetSolo(this.handle, value);
    });
  }
  get mutedViaSolo() {
    return this.dataModel.trackGetMutedViaSolo(this.handle);
  }
  get arm() {
    return this.dataModel.trackGetArm(this.handle);
  }
  set arm(value) {
    this.dataModel.withinTransaction(() => {
      this.dataModel.trackSetArm(this.handle, value);
    });
  }
  get clipSlots() {
    return this.dataModel.trackGetClipSlots(this.handle).map((handle) => this.objectRegistry.getObjectFromHandle(handle, ClipSlot));
  }
  get takeLanes() {
    return this.dataModel.trackGetTakeLanes(this.handle).map((handle) => this.objectRegistry.getObjectFromHandle(handle, TakeLane));
  }
  get arrangementClips() {
    return this.dataModel.trackGetArrangementClips(this.handle).map((handle) => this.objectRegistry.getObjectFromHandle(handle, Clip));
  }
  get groupTrack() {
    const handle = this.dataModel.trackGetGroupTrack(this.handle);
    return handle ? this.objectRegistry.getObjectFromHandle(handle, Track2) : null;
  }
  get devices() {
    return this.dataModel.trackGetDevices(this.handle).map((handle) => this.objectRegistry.getObjectFromHandle(handle, Device));
  }
  get mixer() {
    return this.objectRegistry.getObjectFromHandle(this.dataModel.trackGetMixerDevice(this.handle), TrackMixer);
  }
  /** Appended to the end of {@link takeLanes}. */
  createTakeLane() {
    return createAsync(this.dataModel, this.objectRegistry, TakeLane, this.dataModel.trackCreateTakeLane, this.handle);
  }
  /**
  * Inserts a built-in Live device with its default preset into the track's device chain.
  * Only devices native to Live are supported — third-party plug-ins cannot be loaded this way.
  *
  * @param deviceName - The name of the built-in Live device (e.g. `"Reverb"`, `"Auto Filter"`).
  * @param index - Zero-based position in the device chain at which to insert.
  */
  insertDevice(deviceName, index) {
    return createAsync(this.dataModel, this.objectRegistry, Device, this.dataModel.trackInsertDevice, this.handle, deviceName, BigInt(index));
  }
  /**
  * Deletes a device from this track's device chain. Await the returned
  * promise to ensure the deletion has been fully processed.
  */
  deleteDevice(device) {
    return invokeAsync(this.dataModel, this.dataModel.trackDeleteDevice, this.handle, device.handle);
  }
  /** The duplicate is inserted directly after the original in the device chain. */
  duplicateDevice(device) {
    return createAsync(this.dataModel, this.objectRegistry, Device, this.dataModel.trackDuplicateDevice, this.handle, device.handle);
  }
  /**
  * Deletes an arrangement clip. For session clips, use {@link ClipSlot.deleteClip}.
  * Await the returned promise to ensure the deletion has been fully processed.
  */
  deleteClip(clip) {
    return invokeAsync(this.dataModel, this.dataModel.trackDeleteClip, this.handle, clip.handle);
  }
  /**
  * Deletes clips within the range. Clips that overlap a boundary are truncated
  * to the range edge rather than fully deleted.
  *
  * @param startTime - Start of the range in beats.
  * @param endTime - End of the range in beats.
  */
  clearClipsInRange(startTime, endTime) {
    return invokeAsync(this.dataModel, this.dataModel.trackClearClipsInRange, this.handle, startTime, endTime);
  }
};
var AudioTrack = class extends Track {
  static className = "AudioTrack";
  /**
  * Creates an audio clip from a file in the track's arrangement timeline.
  *
  * @param args.filePath - Absolute path to the audio file.
  * @param args.startTime - Position in the arrangement timeline in beats.
  * @param args.duration - Length of the clip on the arrangement timeline,
  *   in beats. Capped at the sample's natural length for non-looping clips;
  *   looping clips repeat to fill the full length. Defaults to the sample's
  *   natural length at the current tempo when omitted.
  * @param args.isWarped - Whether warping is enabled. Defaults to the clip's
  *   saved `.asd` settings if present, otherwise Live's "Auto-Warp" preference.
  *   Must be provided when `loopSettings` is provided.
  * @param args.loopSettings - Initial loop settings. Requires `isWarped` to be
  *   defined. If `isWarped` is `false`, `loopSettings.looping` must be `false`.
  *
  * @example
  * const clip = await track.createAudioClip({ filePath: '/samples/kick.wav', startTime: 0 });
  *
  * @example
  * const clip = await track.createAudioClip({
  *   filePath: '/samples/ambient.wav',
  *   startTime: 16,
  *   isWarped: false,
  * });
  *
  * @example
  * // Clip view: Start=beat 0, End=beat 2, Loop position=beat 0, Loop length=1 beat.
  * const clip = await track.createAudioClip({
  *   filePath: '/samples/loop.wav',
  *   startTime: 0,
  *   isWarped: true,
  *   loopSettings: { looping: true, startMarker: 0, endMarker: 2, loopStart: 0, loopEnd: 1 },
  * });
  *
  * @example
  * const clip = await track.createAudioClip({
  *   filePath: '/samples/loop.wav',
  *   startTime: 0,
  *   isWarped: true,
  *   duration: 8,
  *   loopSettings: { looping: true, startMarker: 0, endMarker: 2, loopStart: 0, loopEnd: 2 },
  * });
  */
  createAudioClip(args) {
    return createAsync(this.dataModel, this.objectRegistry, AudioClip, this.dataModel.trackCreateAudioClip, this.handle, {
      duration: args.duration,
      filePath: args.filePath,
      isWarped: args.isWarped,
      loopSettings: args.loopSettings,
      startTime: args.startTime
    });
  }
};
var CuePoint = class extends DataModelObject {
  static className = "CuePoint";
  get time() {
    return this.dataModel.cuePointGetTime(this.handle);
  }
  get name() {
    return this.dataModel.cuePointGetName(this.handle);
  }
  set name(value) {
    this.dataModel.withinTransaction(() => {
      this.dataModel.cuePointSetName(this.handle, value);
    });
  }
};
var MidiTrack = class extends Track {
  static className = "MidiTrack";
  /**
  * @param startTime - Position in the arrangement in beats.
  * @param duration - Length of the clip in beats.
  */
  createMidiClip(startTime, duration) {
    return createAsync(this.dataModel, this.objectRegistry, MidiClip, this.dataModel.trackCreateMidiClip, this.handle, startTime, duration);
  }
};
var Scene = class extends DataModelObject {
  static className = "Scene";
  get name() {
    return this.dataModel.sceneGetName(this.handle);
  }
  set name(value) {
    this.dataModel.withinTransaction(() => {
      this.dataModel.sceneSetName(this.handle, value);
    });
  }
  get tempo() {
    return this.dataModel.sceneGetTempo(this.handle);
  }
  get signatureNumerator() {
    return this.dataModel.sceneGetSignatureNumerator(this.handle);
  }
  get signatureDenominator() {
    return this.dataModel.sceneGetSignatureDenominator(this.handle);
  }
};
var Song = class extends DataModelObject {
  static className = "Song";
  /** Regular tracks only — excludes return tracks and the main track. */
  get tracks() {
    return this.dataModel.songGetTracks(this.handle).map((handle) => this.objectRegistry.getObjectFromHandle(handle, Track));
  }
  get returnTracks() {
    return this.dataModel.songGetReturnTracks(this.handle).map((handle) => this.objectRegistry.getObjectFromHandle(handle, Track));
  }
  get mainTrack() {
    return this.objectRegistry.getObjectFromHandle(this.dataModel.songGetMainTrack(this.handle), Track);
  }
  get scenes() {
    return this.dataModel.songGetScenes(this.handle).map((handle) => this.objectRegistry.getObjectFromHandle(handle, Scene));
  }
  get cuePoints() {
    return this.dataModel.songGetCuePoints(this.handle).map((handle) => this.objectRegistry.getObjectFromHandle(handle, CuePoint));
  }
  get tempo() {
    return this.dataModel.songGetTempo(this.handle);
  }
  set tempo(value) {
    this.dataModel.withinTransaction(() => {
      this.dataModel.songSetTempo(this.handle, value);
    });
  }
  /**
  * The current arrangement grid quantization. Use with {@link gridIsTriplet} to
  * determine the full grid setting.
  */
  get gridQuantization() {
    return this.dataModel.songGetGridQuantization(this.handle);
  }
  /**
  * Whether the arrangement grid uses triplet subdivisions of the current
  * {@link gridQuantization} value.
  */
  get gridIsTriplet() {
    return this.dataModel.songGetGridIsTriplet(this.handle);
  }
  /**
  * The root note of the scale currently selected in Live, as a MIDI note number
  * from 0 (C) to 11 (B).
  */
  get rootNote() {
    return Number(this.dataModel.songGetRootNote(this.handle));
  }
  /** The name of the scale selected in Live, as shown in the Current Scale Name chooser. */
  get scaleName() {
    return this.dataModel.songGetScaleName(this.handle);
  }
  /** Whether Live's Scale Mode is enabled. */
  get scaleMode() {
    return this.dataModel.songGetScaleMode(this.handle);
  }
  /** The intervals of the current scale as semitone offsets from the root note. */
  get scaleIntervals() {
    return this.dataModel.songGetScaleIntervals(this.handle).map(Number);
  }
  /** Inserted after the last selected track, or appended if no track is selected. */
  createAudioTrack() {
    return createAsync(this.dataModel, this.objectRegistry, AudioTrack, this.dataModel.songCreateAudioTrack, this.handle);
  }
  /** Inserted after the last selected track, or appended if no track is selected. */
  createMidiTrack() {
    return createAsync(this.dataModel, this.objectRegistry, MidiTrack, this.dataModel.songCreateMidiTrack, this.handle);
  }
  /**
  * @param index - 0-based insert position in the range `[0, song.scenes.length]`.
  * Pass `-1` to append at the end.
  */
  createScene(index) {
    return createAsync(this.dataModel, this.objectRegistry, Scene, this.dataModel.songCreateScene, this.handle, BigInt(index));
  }
  /**
  * Deletes a track from the song. Await the returned promise to ensure the
  * deletion has been fully processed.
  */
  deleteTrack(track) {
    return invokeAsync(this.dataModel, this.dataModel.songDeleteTrack, this.handle, track.handle);
  }
  /**
  * Deletes a scene from the song. Await the returned promise to ensure the
  * deletion has been fully processed.
  */
  deleteScene(scene) {
    return invokeAsync(this.dataModel, this.dataModel.songDeleteScene, this.handle, scene.handle);
  }
  /** Duplicates the track. The duplicate is inserted immediately after the original. */
  duplicateTrack(track) {
    return createAsync(this.dataModel, this.objectRegistry, Track, this.dataModel.songDuplicateTrack, this.handle, track.handle);
  }
  /** Duplicates the scene. The duplicate is inserted immediately after the original. */
  duplicateScene(scene) {
    return createAsync(this.dataModel, this.objectRegistry, Scene, this.dataModel.songDuplicateScene, this.handle, scene.handle);
  }
  /** @param time - Position in the arrangement in beats. */
  createCuePoint(time) {
    return createAsync(this.dataModel, this.objectRegistry, CuePoint, this.dataModel.songCreateCuePoint, this.handle, time);
  }
  /**
  * Deletes a cue point from the song. Await the returned promise to ensure
  * the deletion has been fully processed.
  */
  deleteCuePoint(cuePoint) {
    return invokeAsync(this.dataModel, this.dataModel.songDeleteCuePoint, this.handle, cuePoint.handle);
  }
};
var Application = class extends DataModelObject {
  static className = "Application";
  get song() {
    return this.objectRegistry.getObjectFromHandle(this.dataModel.rootGetSong(this.handle), Song);
  }
};
var Commands = class {
  module;
  /** @internal */
  constructor(module2) {
    this.module = module2;
  }
  /**
  * Registers a command that can be invoked by Live or via {@link Commands.executeCommand}.
  *
  * @param commandId - A unique string identifier for this command.
  * @param callback - Called when the command is invoked. May receive arguments passed by the invoker.
  */
  registerCommand(commandId, callback) {
    this.module.registerCommand(commandId, callback);
  }
  /**
  * Programmatically invokes a registered command.
  *
  * @param commandId - The ID of the command to invoke.
  * @param args - Arguments to pass to the command's callback.
  */
  executeCommand(commandId, ...args) {
    this.module.executeCommand(commandId, ...args);
  }
};
var ChainMixer = class extends DataModelObject {
  static className = "ChainMixerDevice";
  get volume() {
    return this.objectRegistry.getObjectFromHandle(this.dataModel.chainmixerdeviceGetVolume(this.handle), DeviceParameter);
  }
  get panning() {
    return this.objectRegistry.getObjectFromHandle(this.dataModel.chainmixerdeviceGetPanning(this.handle), DeviceParameter);
  }
  get sends() {
    return this.dataModel.chainmixerdeviceGetSends(this.handle).map((handle) => this.objectRegistry.getObjectFromHandle(handle, DeviceParameter));
  }
};
var Chain = class extends DataModelObject {
  static className = "Chain";
  get devices() {
    return this.dataModel.chainGetDevices(this.handle).map((handle) => this.objectRegistry.getObjectFromHandle(handle, Device));
  }
  get mixer() {
    return this.objectRegistry.getObjectFromHandle(this.dataModel.chainGetMixerDevice(this.handle), ChainMixer);
  }
  /**
  * Inserts a built-in Live device with its default preset into the chain.
  * Only devices native to Live are supported — third-party plug-ins cannot be loaded this way.
  *
  * @param deviceName - The name of the built-in Live device (e.g. `"Reverb"`, `"Auto Filter"`).
  * @param index - Zero-based position in the device chain at which to insert.
  */
  insertDevice(deviceName, index) {
    return createAsync(this.dataModel, this.objectRegistry, Device, this.dataModel.chainInsertDevice, this.handle, deviceName, BigInt(index));
  }
  /**
  * Deletes a device from this chain. Await the returned promise to ensure
  * the deletion has been fully processed.
  */
  deleteDevice(device) {
    return invokeAsync(this.dataModel, this.dataModel.chainDeleteDevice, this.handle, device.handle);
  }
  /** The duplicate is inserted directly after the original in the device chain. */
  duplicateDevice(device) {
    return createAsync(this.dataModel, this.objectRegistry, Device, this.dataModel.chainDuplicateDevice, this.handle, device.handle);
  }
};
var DrumChain = class extends Chain {
  static className = "DrumChain";
  get receivingNote() {
    return Number(this.dataModel.drumchainGetReceivingNote(this.handle));
  }
  set receivingNote(value) {
    this.dataModel.withinTransaction(() => {
      this.dataModel.drumchainSetReceivingNote(this.handle, BigInt(value));
    });
  }
};
var RackDevice = class extends Device {
  static className = "RackDevice";
  get chains() {
    return this.dataModel.rackdeviceGetChains(this.handle).map((handle) => this.objectRegistry.getObjectFromHandle(handle, Chain));
  }
  /** @param index - 0-based insert position in the range `[0, rack.chains.length]`. */
  insertChain(index) {
    return createAsync(this.dataModel, this.objectRegistry, Chain, this.dataModel.rackdeviceInsertChain, this.handle, BigInt(index));
  }
};
var DrumRack = class extends RackDevice {
  static className = "DrumRackDevice";
  get chains() {
    return this.dataModel.rackdeviceGetChains(this.handle).map((handle) => this.objectRegistry.getObjectFromHandle(handle, DrumChain));
  }
};
var Sample = class extends DataModelObject {
  static className = "Sample";
  get filePath() {
    return this.dataModel.sampleGetFilePath(this.handle);
  }
};
var Simpler = class extends Device {
  static className = "Simpler";
  get sample() {
    const handle = this.dataModel.simplerGetSample(this.handle);
    return handle ? this.objectRegistry.getObjectFromHandle(handle, Sample) : null;
  }
  /** Replaces the loaded sample with the audio file at the given absolute path. */
  replaceSample(filePath) {
    return createAsync(this.dataModel, this.objectRegistry, Sample, this.dataModel.simplerReplaceSample, this.handle, filePath);
  }
};
var dataModelClasses = [
  Application,
  Song,
  AudioTrack,
  MidiTrack,
  Track,
  AudioClip,
  MidiClip,
  Clip,
  ClipSlot,
  TakeLane,
  Simpler,
  DrumRack,
  RackDevice,
  Device,
  Sample,
  DrumChain,
  Chain,
  Scene,
  CuePoint,
  DeviceParameter,
  TrackMixer,
  ChainMixer
];
var DataModelObjectRegistry = class {
  cache = /* @__PURE__ */ new Map();
  dataModel;
  /** @internal */
  constructor(dataModel) {
    this.dataModel = dataModel;
  }
  getOrCreateObjectFromHandle(handle) {
    const cached = this.cache.get(handle.id);
    if (cached) return cached;
    const ModelClass = dataModelClasses.find((cls) => this.dataModel.getObjectIsOfClass(handle, cls.className));
    if (!ModelClass) throw new Error("Unknown object type");
    const obj = new ModelClass(handle, this.dataModel, this);
    this.cache.set(handle.id, obj);
    return obj;
  }
  /**
  * Resolves a {@link Handle} into a typed SDK object.
  *
  * Pass {@link DataModelObject} as `type` when the exact type of the handle is not known
  * in advance, then use `instanceof` to branch on the actual type:
  *
  * ```ts
  * const obj = objects.getObjectFromHandle(handle, DataModelObject);
  * if (obj instanceof ClipSlot) {
  *   // ...
  * }
  * ```
  *
  * Throws if the underlying object has been deleted, if it is of a different
  * type than `type`, or if its type is not recognised.
  *
  * @param handle - The handle to resolve.
  * @param type - The expected SDK class (e.g. `ClipSlot`).
  */
  getObjectFromHandle(handle, type) {
    const obj = this.getOrCreateObjectFromHandle(handle);
    if (!(obj instanceof type)) throw new Error("Object of incorrect type");
    return obj;
  }
};
var Environment = class {
  module;
  /** @internal */
  constructor(module2) {
    this.module = module2;
  }
  /**
  * Per-extension directory for persistent storage. Use it for configuration, credentials,
  * and cached state — anything that should survive across Live sessions.
  */
  get storageDirectory() {
    return this.module.storageDirectory;
  }
  /**
  * Per-extension directory for temporary files, such as intermediate audio or analysis
  * results. May be cleaned up between sessions.
  */
  get tempDirectory() {
    return this.module.tempDirectory;
  }
  /** Live's current UI language as an uppercase ISO 639-1 code (e.g. `"EN"`, `"DE"`, `"JA"`). */
  get language() {
    return this.module.language;
  }
};
var Resources = class {
  module;
  /** @internal */
  constructor(module2) {
    this.module = module2;
  }
  /**
  * Renders the pre-effects audio of a track in the arrangement between two beat
  * positions. Returns a path to a WAV file written to the extension's temp directory.
  */
  renderPreFxAudio(track, startTime, endTime) {
    return new Promise((resolve, reject) => {
      this.module.renderPreFxAudio(track.handle, {
        endTime,
        startTime
      }, resolve, reject);
    });
  }
  /**
  * Copies a file into the Live project folder so that Live manages it.
  * Returns the path to the imported copy. Use the returned path in subsequent API
  * calls, not the original.
  */
  importIntoProject(filePath) {
    return new Promise((resolve, reject) => {
      this.module.importIntoProject(filePath, resolve, reject);
    });
  }
};
var toProgressOptions = (text, progress) => typeof progress === "number" ? {
  progress,
  text
} : { text };
var Ui = class {
  module;
  /** @internal */
  constructor(module2) {
    this.module = module2;
  }
  /**
  * Registers a context menu action in the given {@link ContextMenuScope}.
  *
  * When the user triggers the action, Live invokes the command identified by
  * `commandId`. Depending on the scope, the command receives either the triggered
  * object's {@link Handle}, an {@link ArrangementSelection}, or a
  * {@link ClipSlotSelection} as its first argument.
  *
  * Returns a function that unregisters the action when called.
  */
  registerContextMenuAction(scope, title, commandId) {
    return new Promise((resolve) => {
      this.module.registerContextMenuAction(scope, title, commandId, (unregister) => {
        resolve(() => new Promise((done) => {
          unregister(done);
        }));
      });
    });
  }
  /**
  * Opens a modal dialog that loads the given URL. Supported URL schemes are
  * `file:`, `data:`, `https:`, and `http://localhost`.
  *
  * To return a result and close the dialog, the dialog's HTML must post the message
  * `{ method: "close_and_send", params: [resultString] }` to the host's message
  * handler — `window.webkit.messageHandlers.live.postMessage` on macOS or
  * `window.chrome.webview.postMessage` on Windows. The returned promise resolves
  * with that string.
  *
  * Rejects if `url` is malformed or an unexpected error occurred.
  */
  showModalDialog(url, width, height) {
    return new Promise((resolve, reject) => {
      this.module.showModalDialog(url, width, height, resolve, reject);
    });
  }
  /**
  * Shows a progress dialog while `callback` runs.
  * The callback receives an `update` function to change the text/progress
  * (progress is a percentage, 0–100), and an `AbortSignal` that fires if
  * the user cancels the dialog.
  * The dialog closes automatically when the callback resolves or rejects.
  *
  * @example
  * ```ts
  * const wavPath = await ui.withinProgressDialog(
  *   "Rendering audio…",
  *   { progress: 0 },
  *   async (update, signal) => {
  *     await update("Analysing…", 30);
  *     if (signal.aborted) return;
  *     await update("Rendering…", 70);
  *     return await resources.renderPreFxAudio(track, startBeat, endBeat);
  *   },
  * );
  * ```
  */
  withinProgressDialog(text, options, callback) {
    const ac = new AbortController();
    return new Promise((resolve, reject) => {
      this.module.showProgressDialog(toProgressOptions(text, options.progress), ({ update, close }) => {
        const asyncUpdate = (updateText, progress) => new Promise((resolveUpdate) => {
          update(toProgressOptions(updateText, progress), resolveUpdate);
        });
        const asyncClose = () => new Promise((done) => {
          close(done);
        });
        callback(asyncUpdate, ac.signal).finally(asyncClose).then(resolve).catch(reject);
      }, () => {
        ac.abort();
      });
    });
  }
};
var initialize = (context, apiVersion) => {
  const { commands, dataModel, environment, resources, ui } = context.initializeExtensionHost({ apiVersion });
  const objectRegistry = new DataModelObjectRegistry(dataModel);
  return {
    application: objectRegistry.getObjectFromHandle(dataModel.getRoot(), Application),
    commands: new Commands(commands),
    environment: new Environment(environment),
    getObjectFromHandle: objectRegistry.getObjectFromHandle.bind(objectRegistry),
    resources: new Resources(resources),
    ui: new Ui(ui),
    withinTransaction: dataModel.withinTransaction.bind(dataModel)
  };
};

// src/extension.ts
var import_node_net = __toESM(require("node:net"), 1);
var import_node_child_process = require("node:child_process");

// src/panel.html
var panel_default = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AbletonQ</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:        hsl(0,0%,15%);
      --bg-raised: hsl(0,0%,20%);
      --bg-input:  hsl(0,0%,11%);
      --border:    hsl(0,0%,8%);
      --text:      hsl(0,0%,72%);
      --text-dim:  hsl(0,0%,38%);
      --accent:    hsl(31,100%,67%);
      --green:     hsl(100,55%,50%);
      --red:       hsl(0,60%,55%);
      --amber:     hsl(38,95%,60%);
      --user-bg:   hsl(0,0%,22%);
      --event-bg:  hsl(220,18%,18%);
    }

    html {
      background: var(--bg);
      color: var(--text);
      font-family: "AbletonSansSmall", ui-monospace, monospace;
      font-size: 11.5px;
      font-weight: 500;
      -webkit-font-smoothing: antialiased;
      height: 100%;
      overflow: hidden;
    }
    body {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    /* \u2500\u2500 Header \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 9px 14px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      height: 38px;
    }
    .title {
      font-size: 11px; font-weight: 700;
      letter-spacing: .08em; text-transform: uppercase;
      color: var(--text-dim);
    }
    .header-right { display:flex; align-items:center; gap:10px; }
    .status-pill  { display:flex; align-items:center; gap:5px; font-size:10px; color:var(--text-dim); }

    .dot {
      width:6px; height:6px; border-radius:50%;
      background:var(--red); transition:background .25s; flex-shrink:0;
    }
    .dot.connected  { background:var(--green); }
    .dot.connecting { background:var(--amber); animation:blink 1s infinite; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }

    .btn-connect {
      font-family:inherit; font-size:10px; font-weight:600;
      padding:2px 10px; height:20px; border-radius:10px;
      border:1px solid var(--border); background:var(--bg-raised);
      color:var(--text-dim); cursor:pointer;
      transition:color .15s, border-color .15s;
    }
    .btn-connect:hover               { color:var(--text); border-color:hsl(0,0%,22%); }
    .btn-connect.connecting          { color:var(--amber); border-color:var(--amber); pointer-events:none; }
    .btn-connect.connected           { color:var(--red);   border-color:var(--red); }

    /* \u2500\u2500 Chat slide-down \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
    #chatWrap {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows .36s cubic-bezier(.4,0,.2,1);
      flex-shrink: 0;
    }
    #chatWrap.open { grid-template-rows: 1fr; }
    #chatInner { overflow:hidden; border-bottom:1px solid var(--border); }

    #chat {
      height: 280px;
      overflow-y: auto;
      padding: 10px 12px 6px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    #chat::-webkit-scrollbar       { width:3px; }
    #chat::-webkit-scrollbar-track { background:transparent; }
    #chat::-webkit-scrollbar-thumb { background:var(--border); border-radius:2px; }

    /* \u2500\u2500 Message bubbles \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
    .msg {
      max-width: 94%;
      padding: 6px 10px;
      border-radius: 3px;
      line-height: 1.55;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 10.5px;
      opacity: 0;
      transform: translateY(6px);
      animation: msgIn .28s cubic-bezier(.16,1,.3,1) forwards;
    }
    @keyframes msgIn { to { opacity:1; transform:translateY(0); } }
    .msg.historic { animation-duration:.18s; }

    .msg.user      { align-self:flex-end;   background:var(--user-bg);   border:1px solid var(--border); color:var(--accent); }
    .msg.assistant { align-self:flex-start; background:var(--bg-raised); border:1px solid var(--border); color:var(--text); font-family:ui-monospace,monospace; font-size:10px; }
    .msg.system    { align-self:center;     color:var(--text-dim); font-size:9.5px; font-style:italic; }
    .msg.event     { align-self:flex-start; background:var(--event-bg);  border:1px solid hsl(220,20%,24%); color:hsl(200,70%,65%); font-family:ui-monospace,monospace; font-size:10px; }

    .msg-ts { font-size:8.5px; color:var(--text-dim); margin-top:3px; }

    /* \u2500\u2500 Input zone \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
    #inputZone { padding:10px 12px 8px; flex-shrink:0; position:relative; }

    .input-row { display:flex; gap:6px; align-items:center; }

    #cmdInput {
      flex:1; background:var(--bg-input); color:var(--text);
      border:1px solid var(--border); font-family:inherit;
      font-size:11px; height:28px; padding:0 10px;
      outline:none; border-radius:2px; transition:border-color .15s;
    }
    #cmdInput:focus        { border-color:hsl(0,0%,24%); }
    #cmdInput::placeholder { color:var(--text-dim); }
    #cmdInput:disabled     { opacity:.35; cursor:not-allowed; }

    #sendBtn {
      font-family:inherit; font-size:10.5px; font-weight:600;
      height:28px; padding:0 14px; border-radius:14px;
      border:1px solid transparent; background:var(--accent);
      color:hsl(0,0%,10%); cursor:pointer; transition:opacity .15s;
      white-space:nowrap; flex-shrink:0;
    }
    #sendBtn:hover:not(:disabled) { opacity:.82; }
    #sendBtn:disabled             { opacity:.25; cursor:not-allowed; }

    /* \u2500\u2500 Toggle chat \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
    .toggle-row {
      display:flex; align-items:center; gap:4px; margin-top:6px;
      background:none; border:none; color:var(--text-dim);
      font-family:inherit; font-size:10px; cursor:pointer;
      padding:0; width:fit-content; transition:color .15s; user-select:none;
    }
    .toggle-row:hover { color:var(--text); }
    .toggle-row .chevron {
      transform:rotate(0deg);
      transition:transform .32s cubic-bezier(.4,0,.2,1);
    }
    .toggle-row.open .chevron { transform:rotate(180deg); }

    /* \u2500\u2500 Command palette \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
    #palette {
      position: absolute;
      bottom: calc(100% + 4px);
      left: 12px;
      right: 12px;
      background: hsl(0,0%,13%);
      border: 1px solid hsl(0,0%,22%);
      border-radius: 6px;
      box-shadow: 0 8px 32px rgba(0,0,0,.6);
      z-index: 100;
      overflow: hidden;
      display: none;
      flex-direction: column;
    }
    #palette.open { display:flex; }

    #paletteSearch {
      background: transparent;
      border: none;
      border-bottom: 1px solid var(--border);
      color: var(--text);
      font-family: inherit;
      font-size: 11px;
      height: 30px;
      padding: 0 10px;
      outline: none;
      flex-shrink: 0;
    }
    #paletteSearch::placeholder { color: var(--text-dim); }

    #paletteList {
      max-height: 180px;
      overflow-y: auto;
      padding: 4px 0;
    }
    #paletteList::-webkit-scrollbar       { width:3px; }
    #paletteList::-webkit-scrollbar-thumb { background:var(--border); border-radius:2px; }

    .pal-item {
      display: flex;
      align-items: baseline;
      gap: 8px;
      padding: 5px 10px;
      cursor: pointer;
      transition: background .1s;
      border-radius: 2px;
    }
    .pal-item:hover, .pal-item.active {
      background: hsl(0,0%,22%);
    }
    .pal-label  { font-size:11px; color:var(--text); flex:1; }
    .pal-type   { font-size:9.5px; color:var(--text-dim); font-family:ui-monospace,monospace; }
    .pal-params { font-size:9px; color:hsl(0,0%,30%); font-family:ui-monospace,monospace; margin-left:auto; }

    /* highlight matched chars */
    .pal-match { color: var(--accent); }

    /* \u2500\u2500 Toasts \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
    #toaster {
      position:fixed; bottom:60px; left:50%; transform:translateX(-50%);
      display:flex; flex-direction:column-reverse; gap:5px;
      z-index:9999; pointer-events:none; width:calc(100% - 24px);
    }
    .toast {
      display:flex; align-items:center; gap:8px;
      padding:7px 11px; border-radius:6px;
      border:1px solid var(--border); background:hsl(0,0%,19%);
      color:var(--text); font-size:10.5px;
      box-shadow:0 4px 18px rgba(0,0,0,.5);
      pointer-events:auto;
      animation:toastIn .22s cubic-bezier(.16,1,.3,1) forwards;
    }
    @keyframes toastIn {
      from{opacity:0;transform:translateY(8px) scale(.95)}
      to  {opacity:1;transform:translateY(0)   scale(1)}
    }
    .toast.hide { animation:toastOut .18s ease forwards; }
    @keyframes toastOut { to{opacity:0;transform:translateY(4px) scale(.96)} }
    .ti{flex-shrink:0;font-size:12px;}
    .toast.success .ti::before{content:"\u2713";color:var(--green);}
    .toast.error   .ti::before{content:"\u2715";color:var(--red);}
    .toast.info    .ti::before{content:"\u25CF";color:var(--accent);}
    .toast.warning .ti::before{content:"!";color:var(--amber);}
  </style>
</head>
<body data-initial-state="">

<!-- Header -->
<header>
  <span class="title">AbletonQ</span>
  <div class="header-right">
    <div class="status-pill">
      <div class="dot" id="dot"></div>
      <span id="statusLabel">Disconnected</span>
    </div>
    <button class="btn-connect" id="connectBtn" onclick="toggleConnect()">Connect</button>
  </div>
</header>

<!-- Chat -->
<div id="chatWrap">
  <div id="chatInner">
    <div id="chat"></div>
  </div>
</div>

<!-- Input -->
<div id="inputZone">
  <!-- Command palette (floats above input) -->
  <div id="palette">
    <input id="paletteSearch" type="text" placeholder="Search commands\u2026"
      oninput="filterPalette(this.value)"
      onkeydown="palKeydown(event)"
      autocomplete="off" spellcheck="false"
    />
    <div id="paletteList"></div>
  </div>

  <div class="input-row">
    <input id="cmdInput" type="text"
      placeholder="Send a command\u2026 (/ for palette)"
      disabled
      oninput="onInputChange(this.value)"
      onkeydown="inputKeydown(event)"
    />
    <button id="sendBtn" onclick="sendCmd()" disabled>Send</button>
  </div>

  <button class="toggle-row" id="toggleBtn" onclick="toggleChat()">
    <svg class="chevron" width="10" height="10" viewBox="0 0 10 10"
         fill="none" stroke="currentColor" stroke-width="1.6">
      <polyline points="2,3.5 5,6.5 8,3.5"/>
    </svg>
    <span id="toggleLabel">Show chat</span>
  </button>
</div>

<div id="toaster"></div>

<script>
// \u2500\u2500 Bridge \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function postToHost(msg) {
  if (window.webkit?.messageHandlers?.live)
    window.webkit.messageHandlers.live.postMessage(msg);
  else if (window.chrome?.webview)
    window.chrome.webview.postMessage(msg);
}
function closeAndSend(payload) {
  postToHost({ method:'close_and_send', params:[JSON.stringify(payload)] });
}

// \u2500\u2500 Toast \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function toast(text, type='info', dur=3200) {
  const el = document.createElement('div');
  el.className = \`toast \${type}\`;
  el.innerHTML = \`<span class="ti"></span><span>\${text}</span>\`;
  document.getElementById('toaster').prepend(el);
  setTimeout(() => {
    el.classList.add('hide');
    el.addEventListener('animationend', () => el.remove(), {once:true});
  }, dur);
}

// \u2500\u2500 Hydrate state \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
let connected   = false;
let chatVisible = false;
const messages  = [];
let cmdList     = [];   // MCP_COMMANDS injected from extension

(function hydrate() {
  try {
    const raw = document.body.dataset.initialState;
    if (!raw) return;
    const s = JSON.parse(decodeURIComponent(raw));
    connected   = !!s.connected;
    chatVisible = !!s.chatVisible;
    cmdList     = s.commands || [];
    (s.messages || []).forEach(m => messages.push(m));
  } catch {}
})();

// \u2500\u2500 DOM refs \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const chatWrap    = document.getElementById('chatWrap');
const chatInner   = document.getElementById('chatInner');
const chat        = document.getElementById('chat');
const toggleBtn   = document.getElementById('toggleBtn');
const toggleLbl   = document.getElementById('toggleLabel');
const dot         = document.getElementById('dot');
const statusLbl   = document.getElementById('statusLabel');
const connectBtn  = document.getElementById('connectBtn');
const cmdInput    = document.getElementById('cmdInput');
const sendBtn     = document.getElementById('sendBtn');
const palette     = document.getElementById('palette');
const palSearch   = document.getElementById('paletteSearch');
const palList     = document.getElementById('paletteList');

// \u2500\u2500 Command history (\u2191/\u2193) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const history   = messages.filter(m => m.role === 'user').map(m => m.text);
let   histIdx   = -1;
let   draftText = '';

// \u2500\u2500 Palette state \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
let palOpen    = false;
let palResults = [];
let palActive  = 0;

function fuzzy(needle, haystack) {
  // returns array of {start,end} match ranges, or null if no match
  needle = needle.toLowerCase();
  haystack = haystack.toLowerCase();
  let ni = 0, ranges = [], start = -1;
  for (let i = 0; i < haystack.length && ni < needle.length; i++) {
    if (haystack[i] === needle[ni]) {
      if (start === -1) start = i;
      ni++;
      if (ni === needle.length) { ranges.push([start, i]); }
    } else if (start !== -1) {
      ranges.push([start, i - 1]);
      start = -1;
      // retry this char
      if (haystack[i] === needle[ni]) { start = i; ni++; }
    }
  }
  return ni === needle.length ? ranges : null;
}

function highlightLabel(label, query) {
  if (!query) return label;
  const lo = label.toLowerCase(), q = query.toLowerCase();
  let out = '', ni = 0;
  for (let i = 0; i < label.length; i++) {
    if (ni < q.length && lo[i] === q[ni]) {
      out += \`<span class="pal-match">\${label[i]}</span>\`;
      ni++;
    } else {
      out += label[i];
    }
  }
  return out;
}

function openPalette() {
  palOpen = true;
  palette.classList.add('open');
  filterPalette('');
  palSearch.value = '';
  palSearch.focus();
}

function closePalette() {
  palOpen = false;
  palette.classList.remove('open');
  cmdInput.focus();
}

function filterPalette(q) {
  q = q.trim();
  palResults = q
    ? cmdList.filter(c => fuzzy(q, c.label) || fuzzy(q, c.type))
    : cmdList.slice();
  palActive = 0;
  renderPalette(q);
}

function renderPalette(q = '') {
  palList.innerHTML = '';
  if (!palResults.length) {
    palList.innerHTML = '<div style="padding:8px 10px;color:var(--text-dim);font-size:10px;">No matches</div>';
    return;
  }
  palResults.forEach((cmd, i) => {
    const el = document.createElement('div');
    el.className = 'pal-item' + (i === palActive ? ' active' : '');
    const paramStr = cmd.params.length
      ? cmd.params.map(p => p.name).join(', ')
      : '';
    el.innerHTML = \`
      <span class="pal-label">\${highlightLabel(cmd.label, q)}</span>
      <span class="pal-type">\${cmd.type}</span>
      \${paramStr ? \`<span class="pal-params">\${paramStr}</span>\` : ''}
    \`;
    el.onclick = () => selectPaletteItem(i);
    palList.appendChild(el);
  });
}

function selectPaletteItem(i) {
  const cmd = palResults[i];
  if (!cmd) return;
  // Build the JSON skeleton and put it in the input
  const obj = { type: cmd.type, params: {} };
  cmd.params.forEach(p => { obj.params[p.name] = p.ex; });
  const json = cmd.params.length
    ? JSON.stringify(obj)
    : JSON.stringify({ type: cmd.type });
  cmdInput.value = json;
  closePalette();
}

function palKeydown(e) {
  if (e.key === 'Escape') { closePalette(); e.preventDefault(); return; }
  if (e.key === 'ArrowDown') {
    palActive = Math.min(palActive + 1, palResults.length - 1);
    renderPalette(palSearch.value);
    e.preventDefault();
  } else if (e.key === 'ArrowUp') {
    palActive = Math.max(palActive - 1, 0);
    renderPalette(palSearch.value);
    e.preventDefault();
  } else if (e.key === 'Enter') {
    selectPaletteItem(palActive);
    e.preventDefault();
  } else if (e.key === 'Tab') {
    selectPaletteItem(palActive);
    e.preventDefault();
  }
}

// \u2500\u2500 Input field behaviour \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function onInputChange(val) {
  if (val === '/' && !palOpen) {
    cmdInput.value = '';
    openPalette();
  } else if (palOpen && !val) {
    closePalette();
  }
  histIdx = -1;
}

function inputKeydown(e) {
  if (e.key === 'Enter' && !palOpen) { sendCmd(); return; }

  // \u2191/\u2193 history navigation
  if (e.key === 'ArrowUp' && !palOpen) {
    e.preventDefault();
    if (history.length === 0) return;
    if (histIdx === -1) {
      draftText = cmdInput.value;
      histIdx = history.length - 1;
    } else {
      histIdx = Math.max(0, histIdx - 1);
    }
    cmdInput.value = history[histIdx];
    // move cursor to end
    setTimeout(() => cmdInput.setSelectionRange(cmdInput.value.length, cmdInput.value.length), 0);
  } else if (e.key === 'ArrowDown' && !palOpen) {
    e.preventDefault();
    if (histIdx === -1) return;
    histIdx++;
    if (histIdx >= history.length) {
      histIdx = -1;
      cmdInput.value = draftText;
    } else {
      cmdInput.value = history[histIdx];
    }
  } else if (e.key === 'Escape' && palOpen) {
    closePalette();
  }
}

// \u2500\u2500 Chat render \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function renderMessages() {
  chat.innerHTML = '';
  if (!messages.length) {
    const hint = document.createElement('div');
    hint.className = 'msg system historic';
    hint.textContent = 'No messages yet. Type / to browse commands.';
    chat.appendChild(hint);
    return;
  }
  messages.forEach((m, i) => appendBubble(m, true, i * 35));
  requestAnimationFrame(() => { chat.scrollTop = chat.scrollHeight; });
}

function appendBubble(m, historic = false, delayMs = 0) {
  const div = document.createElement('div');
  div.className = \`msg \${m.role}\${historic ? ' historic' : ''}\`;
  div.style.animationDelay = \`\${delayMs}ms\`;
  div.textContent = m.text;
  if (m.role !== 'system') {
    const ts = document.createElement('div');
    ts.className = 'msg-ts';
    ts.textContent = new Date(m.ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
    div.appendChild(ts);
  }
  chat.appendChild(div);
}

// \u2500\u2500 Chat toggle \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function setChatVisible(val) {
  chatVisible = val;
  if (val) {
    chatWrap.classList.add('open');
    toggleBtn.classList.add('open');
    toggleLbl.textContent = 'Hide chat';
    renderMessages();
    requestAnimationFrame(() => { chat.scrollTop = chat.scrollHeight; });
  } else {
    chatWrap.classList.remove('open');
    toggleBtn.classList.remove('open');
    toggleLbl.textContent = 'Show chat';
  }
}
function toggleChat() { setChatVisible(!chatVisible); }

// \u2500\u2500 Connection \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function applyConnected(val) {
  connected = val;
  dot.className          = 'dot' + (val ? ' connected' : '');
  statusLbl.textContent  = val ? 'Connected' : 'Disconnected';
  connectBtn.textContent = val ? 'Disconnect' : 'Connect';
  connectBtn.className   = 'btn-connect' + (val ? ' connected' : '');
  cmdInput.disabled = !val;
  sendBtn.disabled  = !val;
  if (val) cmdInput.focus();
}

function toggleConnect() {
  if (connected) {
    closeAndSend({ action:'disconnect', chatVisible });
  } else {
    dot.className          = 'dot connecting';
    statusLbl.textContent  = 'Connecting\u2026';
    connectBtn.textContent = 'Connecting\u2026';
    connectBtn.className   = 'btn-connect connecting';
    closeAndSend({ action:'connect', chatVisible });
  }
}

// \u2500\u2500 Send \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function sendCmd() {
    const text = cmdInput.value.trim();
    if (!text || !connected) return;
    // Add to history (similar to native app)
    if (!history.includes(text)) {
        history.push(text);
        // Cap history to avoid unbounded growth (matching native app)
        if (history.length > 200) {
            history.shift(); // Remove oldest entry
        }
    }
    cmdInput.value = '';
    histIdx = -1;
    closeAndSend({ action:'send', payload:text, chatVisible });
}

// \u2500\u2500 Click outside palette to close \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
document.addEventListener('mousedown', e => {
  if (palOpen && !palette.contains(e.target) && e.target !== cmdInput) {
    closePalette();
  }
});

// \u2500\u2500 Boot \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
applyConnected(connected);
setChatVisible(chatVisible);

if (window.__toastOnLoad)
  toast(window.__toastOnLoad.text, window.__toastOnLoad.type);
</script>
</body>
</html>
`;

// src/extension.ts
var MCP_HOST = "127.0.0.1";
var MCP_PORT = 9877;
var WIN_W = 420;
var WIN_H_COLLAPSED = 96;
var WIN_H_EXPANDED = 378;
var MCP_COMMANDS = [
  { type: "get_session_info", label: "Get Session Info", params: [] },
  { type: "get_tracks", label: "Get Tracks", params: [] },
  { type: "get_tempo", label: "Get Tempo", params: [] },
  { type: "set_tempo", label: "Set Tempo", params: [{ name: "tempo", type: "number", ex: 120 }] },
  { type: "start_playback", label: "Start Playback", params: [] },
  { type: "stop_playback", label: "Stop Playback", params: [] },
  { type: "undo", label: "Undo", params: [] },
  { type: "redo", label: "Redo", params: [] },
  { type: "create_midi_track", label: "Create MIDI Track", params: [{ name: "index", type: "number", ex: -1 }] },
  { type: "create_audio_track", label: "Create Audio Track", params: [{ name: "index", type: "number", ex: -1 }] },
  { type: "create_return_track", label: "Create Return Track", params: [] },
  { type: "delete_track", label: "Delete Track", params: [{ name: "track_index", type: "number", ex: 0 }] },
  { type: "set_track_name", label: "Set Track Name", params: [{ name: "track_index", type: "number", ex: 0 }, { name: "name", type: "string", ex: "Bass" }] },
  { type: "set_track_volume", label: "Set Track Volume", params: [{ name: "track_index", type: "number", ex: 0 }, { name: "volume", type: "number", ex: 0.85 }] },
  { type: "set_track_pan", label: "Set Track Pan", params: [{ name: "track_index", type: "number", ex: 0 }, { name: "pan", type: "number", ex: 0 }] },
  { type: "mute_track", label: "Mute Track", params: [{ name: "track_index", type: "number", ex: 0 }] },
  { type: "unmute_track", label: "Unmute Track", params: [{ name: "track_index", type: "number", ex: 0 }] },
  { type: "solo_track", label: "Solo Track", params: [{ name: "track_index", type: "number", ex: 0 }] },
  { type: "arm_track", label: "Arm Track", params: [{ name: "track_index", type: "number", ex: 0 }] },
  { type: "create_clip", label: "Create Clip", params: [{ name: "track_index", type: "number", ex: 0 }, { name: "clip_index", type: "number", ex: 0 }, { name: "length", type: "number", ex: 4 }] },
  { type: "delete_clip", label: "Delete Clip", params: [{ name: "track_index", type: "number", ex: 0 }, { name: "clip_index", type: "number", ex: 0 }] },
  { type: "fire_clip", label: "Fire Clip", params: [{ name: "track_index", type: "number", ex: 0 }, { name: "clip_index", type: "number", ex: 0 }] },
  { type: "stop_clip", label: "Stop Clip", params: [{ name: "track_index", type: "number", ex: 0 }, { name: "clip_index", type: "number", ex: 0 }] },
  { type: "get_clip_notes", label: "Get Clip Notes", params: [{ name: "track_index", type: "number", ex: 0 }, { name: "clip_index", type: "number", ex: 0 }] },
  { type: "add_notes_to_clip", label: "Add Notes to Clip", params: [{ name: "track_index", type: "number", ex: 0 }, { name: "clip_index", type: "number", ex: 0 }, { name: "notes", type: "array", ex: [] }] },
  { type: "set_clip_name", label: "Set Clip Name", params: [{ name: "track_index", type: "number", ex: 0 }, { name: "clip_index", type: "number", ex: 0 }, { name: "name", type: "string", ex: "Intro" }] },
  { type: "load_instrument", label: "Load Instrument", params: [{ name: "track_index", type: "number", ex: 0 }, { name: "uri", type: "string", ex: "" }] },
  { type: "get_device_params", label: "Get Device Params", params: [{ name: "track_index", type: "number", ex: 0 }, { name: "device_index", type: "number", ex: 0 }] },
  { type: "set_device_param", label: "Set Device Param", params: [{ name: "track_index", type: "number", ex: 0 }, { name: "device_index", type: "number", ex: 0 }, { name: "param_index", type: "number", ex: 0 }, { name: "value", type: "number", ex: 0.5 }] }
];
var AbletonSocket = class {
  socket = null;
  buffer = "";
  pending = /* @__PURE__ */ new Map();
  onStatusChange;
  onError;
  onEvent;
  // ← push events
  // ── Auto-reconnect state ──────────────────────────────────────────────────
  _wantConnected = false;
  _retryTimer = null;
  _retryDelay = 1e3;
  // ms, doubles on each failure
  _maxRetryDelay = 3e4;
  connect() {
    this._wantConnected = true;
    this._retryDelay = 1e3;
    this._tryConnect();
  }
  _tryConnect() {
    if (this.socket || !this._wantConnected) return;
    const sock = new import_node_net.default.Socket();
    sock.setEncoding("utf8");
    sock.on("connect", () => {
      this.socket = sock;
      this._retryDelay = 1e3;
      this.onStatusChange?.(true);
    });
    sock.on("data", (chunk) => {
      this.buffer += chunk;
      const lines = this.buffer.split("\n");
      this.buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id) {
            const p = this.pending.get(msg.id);
            if (p) {
              this.pending.delete(msg.id);
              p.resolve(msg);
            }
          } else if (msg.event) {
            this.onEvent?.(msg.event, msg.data);
          }
        } catch {
        }
      }
    });
    sock.on("close", () => {
      this.socket = null;
      for (const p of this.pending.values()) p.reject(new Error("Socket closed"));
      this.pending.clear();
      this.onStatusChange?.(false);
      if (this._wantConnected) {
        this._retryTimer = setTimeout(() => {
          this._retryDelay = Math.min(this._retryDelay * 2, this._maxRetryDelay);
          this._tryConnect();
        }, this._retryDelay);
      }
    });
    sock.on("error", (err) => {
      this.onError?.(err.message);
    });
    sock.connect(MCP_PORT, MCP_HOST);
  }
  disconnect() {
    this._wantConnected = false;
    if (this._retryTimer) {
      clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }
    this.socket?.destroy();
    this.socket = null;
  }
  isConnected() {
    return this.socket !== null && !this.socket.destroyed;
  }
  send(req) {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.destroyed) {
        reject(new Error("Not connected"));
        return;
      }
      this.pending.set(req.id, { resolve, reject });
      this.socket.write(JSON.stringify(req) + "\n");
      setTimeout(() => {
        if (this.pending.has(req.id)) {
          this.pending.delete(req.id);
          reject(new Error("Request timed out"));
        }
      }, 1e4);
    });
  }
};
function launchMcpApp() {
  const possiblePaths = [
    "/Applications/AbletonQ.app",
    `${process.env.HOME}/Applications/AbletonQ.app`
  ];
  let tried = 0;
  function tryOpen(path) {
    (0, import_node_child_process.execFile)("open", [path], (err) => {
      if (!err) {
        return;
      }
      tried++;
      if (tried === possiblePaths.length) {
        const script = `tell application "Terminal"
          activate
          do script "uvx ableton-q"
        end tell`;
        (0, import_node_child_process.execFile)("osascript", ["-e", script], (err2) => {
          if (err2) console.error("[abletonq] launch fallback failed:", err2.message);
        });
      } else {
        tryOpen(possiblePaths[tried]);
      }
    });
  }
  if (possiblePaths.length > 0) {
    tryOpen(possiblePaths[0]);
  } else {
    const script = `tell application "Terminal"
      activate
      do script "uvx ableton-q"
    end tell`;
    (0, import_node_child_process.execFile)("osascript", ["-e", script], (err2) => {
      if (err2) console.error("[abletonq] launch fallback failed:", err2.message);
    });
  }
}
function buildPanelHtml(messages, connected, chatVisible, commands, toastOnLoad) {
  const state = encodeURIComponent(JSON.stringify({
    messages,
    connected,
    chatVisible,
    commands: commands.map((c) => ({
      type: c.type,
      label: c.label,
      params: c.params
    }))
  }));
  let html = panel_default.replace(
    /data-initial-state="[^"]*"/,
    `data-initial-state="${state}"`
  );
  if (toastOnLoad) {
    const inj = `<script>window.__toastOnLoad=${JSON.stringify(toastOnLoad)};</script>`;
    html = html.replace("</head>", inj + "\n</head>");
  }
  return html;
}
function activate(activation) {
  const ctx = initialize(activation, "1.0.0");
  const sock = new AbletonSocket();
  const messages = [];
  let reqCounter = 0;
  let dialogOpen = false;
  let chatVisible = false;
  function nextId() {
    return `req-${++reqCounter}`;
  }
  function pushMsg(m) {
    messages.push(m);
  }
  async function openPanel(toastOnLoad) {
    if (dialogOpen) return;
    dialogOpen = true;
    const html = buildPanelHtml(
      messages,
      sock.isConnected(),
      chatVisible,
      MCP_COMMANDS,
      toastOnLoad
    );
    const h = chatVisible ? WIN_H_EXPANDED : WIN_H_COLLAPSED;
    let raw;
    try {
      raw = await ctx.ui.showModalDialog(
        `data:text/html,${encodeURIComponent(html)}`,
        WIN_W,
        h
      );
    } catch {
      dialogOpen = false;
      return;
    }
    dialogOpen = false;
    let env;
    try {
      env = JSON.parse(raw);
    } catch {
      return;
    }
    if (typeof env.chatVisible === "boolean") chatVisible = env.chatVisible;
    if (env.action === "connect") {
      if (!sock.isConnected()) {
        launchMcpApp();
        setTimeout(() => sock.connect(), 1500);
      }
    } else if (env.action === "disconnect") {
      sock.disconnect();
    } else if (env.action === "send" && env.payload?.trim()) {
      const userText = env.payload.trim();
      pushMsg({ role: "user", text: userText, ts: Date.now() });
      let req;
      try {
        const p = JSON.parse(userText);
        req = { id: nextId(), type: p.type ?? "raw", params: p.params };
      } catch {
        req = { id: nextId(), type: "get_session_info" };
      }
      let toastAfter;
      try {
        const resp = await sock.send(req);
        const text = resp.status === "ok" ? JSON.stringify(resp.result, null, 2) : `Error: ${resp.message}`;
        pushMsg({ role: "assistant", text, ts: Date.now() });
        toastAfter = resp.status === "ok" ? { text: "OK", type: "success" } : { text: resp.message ?? "Error", type: "error" };
      } catch (err) {
        const msg = err.message;
        pushMsg({ role: "assistant", text: `Failed: ${msg}`, ts: Date.now() });
        toastAfter = { text: msg, type: "error" };
      }
      openPanel(toastAfter);
    } else if (env.action === "noop") {
      openPanel();
    }
  }
  sock.onStatusChange = (connected) => {
    const toast = connected ? { text: `Connected :${MCP_PORT}`, type: "success" } : { text: "Disconnected \u2014 retrying\u2026", type: "warning" };
    pushMsg({
      role: "system",
      text: connected ? `Connected to Ableton on ${MCP_HOST}:${MCP_PORT}` : "Disconnected \u2014 auto-reconnecting\u2026",
      ts: Date.now()
    });
    if (!dialogOpen) openPanel(toast);
  };
  sock.onError = (msg) => {
    console.error("[abletonq] socket error:", msg);
  };
  sock.onEvent = (event, data) => {
    const text = `\u26A1 ${event}${data ? "\n" + JSON.stringify(data, null, 2) : ""}`;
    pushMsg({ role: "event", text, ts: Date.now() });
    if (!dialogOpen) openPanel({ text: event, type: "info" });
  };
  ctx.commands.registerCommand("abletonQ.openPanel", () => openPanel());
  ctx.ui.registerContextMenuAction("ClipSlot", "Open AbletonQ", "abletonQ.openPanel");
  console.log("[abletonq] activated");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MCP_COMMANDS,
  activate
});
//# sourceMappingURL=extension.js.map
