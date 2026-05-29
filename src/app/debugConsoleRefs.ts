import { requireElement } from './dom';

export function getDebugConsoleRefs(root: ParentNode) {
  const pauseToggle = requireElement(root, '#pause-toggle', HTMLButtonElement);
  const resetActorsButton = requireElement(root, '#reset-actors', HTMLButtonElement);
  const showWorldToggle = requireElement(root, '#show-world', HTMLInputElement);
  const showVisualBoundsToggle = requireElement(
    root,
    '#show-visual-bounds',
    HTMLInputElement
  );
  const showHitBoxesToggle = requireElement(root, '#show-hit-boxes', HTMLInputElement);
  const showAttackBoxesToggle = requireElement(
    root,
    '#show-attack-boxes',
    HTMLInputElement
  );
  const showOriginsToggle = requireElement(root, '#show-origins', HTMLInputElement);
  const showPointerProbeToggle = requireElement(
    root,
    '#show-pointer-probe',
    HTMLInputElement
  );
  const showEnemyRangesToggle = requireElement(
    root,
    '#show-enemy-ranges',
    HTMLInputElement
  );
  const laneEditorControls = requireElement(root, '#lane-editor-controls', HTMLElement);
  const showLaneGuidesToggle = requireElement(
    root,
    '#show-lane-guides',
    HTMLInputElement
  );
  const laneUpperYInput = requireElement(root, '#lane-upper-y', HTMLInputElement);
  const laneMiddleYInput = requireElement(root, '#lane-middle-y', HTMLInputElement);
  const laneLowerYInput = requireElement(root, '#lane-lower-y', HTMLInputElement);
  const laneUpperYReadout = requireElement(root, '#lane-upper-y-readout', HTMLElement);
  const laneMiddleYReadout = requireElement(root, '#lane-middle-y-readout', HTMLElement);
  const laneLowerYReadout = requireElement(root, '#lane-lower-y-readout', HTMLElement);
  const laneUpperYNumberInput = requireElement(
    root,
    '#lane-upper-y-number',
    HTMLInputElement
  );
  const laneMiddleYNumberInput = requireElement(
    root,
    '#lane-middle-y-number',
    HTMLInputElement
  );
  const laneLowerYNumberInput = requireElement(
    root,
    '#lane-lower-y-number',
    HTMLInputElement
  );
  const laneSaveButton = requireElement(root, '#lane-save', HTMLButtonElement);
  const laneResetButton = requireElement(root, '#lane-reset', HTMLButtonElement);
  const laneSaveStatus = requireElement(root, '#lane-save-status', HTMLElement);
  const enemyAiToggle = requireElement(root, '#enemy-ai', HTMLInputElement);
  const backgroundFileSelect = requireElement(
    root,
    '#background-file',
    HTMLSelectElement
  );
  const bgmTrackSelect = requireElement(root, '#bgm-track', HTMLSelectElement);
  const tuningPlayerSpeedInput = requireElement(
    root,
    '#tuning-player-speed',
    HTMLInputElement
  );
  const tuningPlayerSpeedReadout = requireElement(
    root,
    '#tuning-player-speed-readout',
    HTMLElement
  );
  const tuningEnemySpeedInput = requireElement(
    root,
    '#tuning-enemy-speed',
    HTMLInputElement
  );
  const tuningEnemySpeedReadout = requireElement(
    root,
    '#tuning-enemy-speed-readout',
    HTMLElement
  );
  const tuningRecoveryInput = requireElement(root, '#tuning-recovery', HTMLInputElement);
  const tuningRecoveryReadout = requireElement(
    root,
    '#tuning-recovery-readout',
    HTMLElement
  );
  const tuningKnockbackInput = requireElement(root, '#tuning-knockback', HTMLInputElement);
  const tuningKnockbackReadout = requireElement(
    root,
    '#tuning-knockback-readout',
    HTMLElement
  );
  const tuningRoundBaseInput = requireElement(
    root,
    '#tuning-round-base',
    HTMLInputElement
  );
  const tuningRoundBaseReadout = requireElement(
    root,
    '#tuning-round-base-readout',
    HTMLElement
  );
  const tuningRoundStepInput = requireElement(
    root,
    '#tuning-round-step',
    HTMLInputElement
  );
  const tuningRoundStepReadout = requireElement(
    root,
    '#tuning-round-step-readout',
    HTMLElement
  );
  const tuningRoundMaxInput = requireElement(
    root,
    '#tuning-round-max',
    HTMLInputElement
  );
  const tuningRoundMaxReadout = requireElement(
    root,
    '#tuning-round-max-readout',
    HTMLElement
  );
  const tuningRoundWaitInput = requireElement(
    root,
    '#tuning-round-wait',
    HTMLInputElement
  );
  const tuningRoundWaitReadout = requireElement(
    root,
    '#tuning-round-wait-readout',
    HTMLElement
  );
  const tuningRoundGrowthSelect = requireElement(
    root,
    '#tuning-round-growth',
    HTMLSelectElement
  );
  const tuningSaveButton = requireElement(root, '#tuning-save', HTMLButtonElement);
  const tuningResetButton = requireElement(root, '#tuning-reset', HTMLButtonElement);
  const tuningSaveStatus = requireElement(root, '#tuning-save-status', HTMLElement);
  const levelProgressList = requireElement(root, '#level-progress-list', HTMLElement);
  const levelProgressCompleteButton = requireElement(
    root,
    '#level-progress-complete',
    HTMLButtonElement
  );
  const levelProgressResetButton = requireElement(
    root,
    '#level-progress-reset',
    HTMLButtonElement
  );
  const backgroundLabControls = requireElement(root, '#background-lab-controls', HTMLElement);
  const backgroundFitModeSelect = requireElement(
    root,
    '#background-fit-mode',
    HTMLSelectElement
  );
  const backgroundShowGridToggle = requireElement(
    root,
    '#background-show-grid',
    HTMLInputElement
  );
  const backgroundShowSafeToggle = requireElement(
    root,
    '#background-show-safe',
    HTMLInputElement
  );
  const backgroundShowBaselineToggle = requireElement(
    root,
    '#background-show-baseline',
    HTMLInputElement
  );
  const backgroundScrollSpeedInput = requireElement(
    root,
    '#background-scroll-speed',
    HTMLInputElement
  );
  const backgroundScrollReadout = requireElement(
    root,
    '#background-scroll-readout',
    HTMLElement
  );
  const runnerControls = requireElement(root, '#runner-controls', HTMLElement);
  const runnerSeedInput = requireElement(root, '#runner-seed', HTMLInputElement);
  const runnerSeedReadout = requireElement(root, '#runner-seed-readout', HTMLElement);
  const runnerDifficultyInput = requireElement(
    root,
    '#runner-difficulty',
    HTMLInputElement
  );
  const runnerDifficultyReadout = requireElement(
    root,
    '#runner-difficulty-readout',
    HTMLElement
  );
  const runnerGapsInput = requireElement(root, '#runner-gaps', HTMLInputElement);
  const runnerGapsReadout = requireElement(root, '#runner-gaps-readout', HTMLElement);
  const runnerLanesInput = requireElement(root, '#runner-lanes', HTMLInputElement);
  const runnerLanesReadout = requireElement(root, '#runner-lanes-readout', HTMLElement);
  const runnerSpeedInput = requireElement(root, '#runner-speed', HTMLInputElement);
  const runnerSpeedReadout = requireElement(root, '#runner-speed-readout', HTMLElement);
  const runnerShowPlanToggle = requireElement(
    root,
    '#runner-show-plan',
    HTMLInputElement
  );
  const runnerShowHitboxesToggle = requireElement(
    root,
    '#runner-show-hitboxes',
    HTMLInputElement
  );
  const baselineControls = requireElement(root, '#baseline-controls', HTMLElement);
  const baselineLevelSelect = requireElement(
    root,
    '#baseline-level-select',
    HTMLSelectElement
  );
  const baselineShowHitboxesToggle = requireElement(
    root,
    '#baseline-show-hitboxes',
    HTMLInputElement
  );
  const baselineShowSpawnGoalToggle = requireElement(
    root,
    '#baseline-show-spawn-goal',
    HTMLInputElement
  );
  const baselineShowCameraBandsToggle = requireElement(
    root,
    '#baseline-show-camera-bands',
    HTMLInputElement
  );
  const elementEditorControls = requireElement(root, '#element-editor-controls', HTMLElement);
  const elementLevelSelect = requireElement(root, '#element-level', HTMLSelectElement);
  const elementKindSelect = requireElement(root, '#element-kind', HTMLSelectElement);
  const elementShowGridToggle = requireElement(
    root,
    '#element-show-grid',
    HTMLInputElement
  );
  const elementShowLabelsToggle = requireElement(
    root,
    '#element-show-labels',
    HTMLInputElement
  );
  const elementShowCollisionToggle = requireElement(
    root,
    '#element-show-collision',
    HTMLInputElement
  );
  const elementAddButton = requireElement(root, '#element-add', HTMLButtonElement);
  const elementDuplicateButton = requireElement(
    root,
    '#element-duplicate',
    HTMLButtonElement
  );
  const elementDeleteButton = requireElement(root, '#element-delete', HTMLButtonElement);
  const elementSaveButton = requireElement(root, '#element-save', HTMLButtonElement);
  const elementExportButton = requireElement(root, '#element-export', HTMLButtonElement);
  const elementEditorReadout = requireElement(root, '#element-editor-readout', HTMLElement);
  const gymControls = requireElement(root, '#gym-controls', HTMLElement);
  const gymExitButton = requireElement(root, '#gym-exit', HTMLButtonElement);
  const gymActorSelect = requireElement(root, '#gym-actor', HTMLSelectElement);
  const gymDirectionSelect = requireElement(root, '#gym-direction', HTMLSelectElement);
  const gymActionSelect = requireElement(root, '#gym-action', HTMLSelectElement);
  const gymShowVisualToggle = requireElement(root, '#gym-show-visual', HTMLInputElement);
  const gymShowCollisionToggle = requireElement(
    root,
    '#gym-show-collision',
    HTMLInputElement
  );
  const gymShowAttackToggle = requireElement(root, '#gym-show-attack', HTMLInputElement);
  const gymPlaybackRateInput = requireElement(
    root,
    '#gym-playback-rate',
    HTMLInputElement
  );
  const gymPlaybackReadout = requireElement(root, '#gym-playback-readout', HTMLElement);
  const gymFrameReadout = requireElement(root, '#gym-frame-readout', HTMLElement);
  const gymAttackFrameReadout = requireElement(
    root,
    '#gym-attack-frame-readout',
    HTMLElement
  );
  const gymAttackFrameStrip = requireElement(root, '#gym-attack-frame-strip', HTMLElement);
  const gymToggleCurrentHitFrameButton = requireElement(
    root,
    '#gym-toggle-current-hit-frame',
    HTMLButtonElement
  );
  const gymOnlyCurrentHitFrameButton = requireElement(
    root,
    '#gym-only-current-hit-frame',
    HTMLButtonElement
  );
  const gymClearHitFramesButton = requireElement(
    root,
    '#gym-clear-hit-frames',
    HTMLButtonElement
  );
  const gymResetHitFramesButton = requireElement(
    root,
    '#gym-reset-hit-frames',
    HTMLButtonElement
  );
  const gymBoundsKindSelect = requireElement(root, '#gym-bounds-kind', HTMLSelectElement);
  const gymBoundsXInput = requireElement(root, '#gym-bounds-x', HTMLInputElement);
  const gymBoundsYInput = requireElement(root, '#gym-bounds-y', HTMLInputElement);
  const gymBoundsWidthInput = requireElement(
    root,
    '#gym-bounds-width',
    HTMLInputElement
  );
  const gymBoundsHeightInput = requireElement(
    root,
    '#gym-bounds-height',
    HTMLInputElement
  );
  const gymSaveBoundsButton = requireElement(
    root,
    '#gym-save-bounds',
    HTMLButtonElement
  );
  const gymResetBoundsButton = requireElement(
    root,
    '#gym-reset-bounds',
    HTMLButtonElement
  );
  const gymMirrorDirectionButton = requireElement(
    root,
    '#gym-mirror-direction',
    HTMLButtonElement
  );
  const gymApplyKindAllButton = requireElement(
    root,
    '#gym-apply-kind-all',
    HTMLButtonElement
  );
  const gymApplyAllButton = requireElement(root, '#gym-apply-all', HTMLButtonElement);
  const gymLaneAnchorReadout = requireElement(root, '#gym-lane-anchor-readout', HTMLElement);
  const gymLaneAnchorXInput = requireElement(
    root,
    '#gym-lane-anchor-x',
    HTMLInputElement
  );
  const gymLaneAnchorYInput = requireElement(
    root,
    '#gym-lane-anchor-y',
    HTMLInputElement
  );
  const gymMirrorLaneAnchorButton = requireElement(
    root,
    '#gym-mirror-lane-anchor',
    HTMLButtonElement
  );
  const gymApplyLaneAnchorAllButton = requireElement(
    root,
    '#gym-apply-lane-anchor-all',
    HTMLButtonElement
  );
  const gymSaveStatusElement = requireElement(root, '#gym-save-status', HTMLElement);
  const sceneReadout = requireElement(root, '#scene-readout', HTMLElement);
  const fpsReadout = requireElement(root, '#fps-readout', HTMLElement);
  const pointerReadout = requireElement(root, '#pointer-readout', HTMLElement);
  const inputReadout = requireElement(root, '#input-readout', HTMLElement);
  const playerReadout = requireElement(root, '#player-readout', HTMLElement);
  const enemyReadout = requireElement(root, '#enemy-readout', HTMLElement);
  const attackReadout = requireElement(root, '#attack-readout', HTMLElement);
  const roundReadout = requireElement(root, '#round-readout', HTMLElement);

  return {
    pauseToggle,
    resetActorsButton,
    showWorldToggle,
    showVisualBoundsToggle,
    showHitBoxesToggle,
    showAttackBoxesToggle,
    showOriginsToggle,
    showPointerProbeToggle,
    showEnemyRangesToggle,
    laneEditorControls,
    showLaneGuidesToggle,
    laneUpperYInput,
    laneMiddleYInput,
    laneLowerYInput,
    laneUpperYReadout,
    laneMiddleYReadout,
    laneLowerYReadout,
    laneUpperYNumberInput,
    laneMiddleYNumberInput,
    laneLowerYNumberInput,
    laneSaveButton,
    laneResetButton,
    laneSaveStatus,
    enemyAiToggle,
    backgroundFileSelect,
    bgmTrackSelect,
    tuningPlayerSpeedInput,
    tuningPlayerSpeedReadout,
    tuningEnemySpeedInput,
    tuningEnemySpeedReadout,
    tuningRecoveryInput,
    tuningRecoveryReadout,
    tuningKnockbackInput,
    tuningKnockbackReadout,
    tuningRoundBaseInput,
    tuningRoundBaseReadout,
    tuningRoundStepInput,
    tuningRoundStepReadout,
    tuningRoundMaxInput,
    tuningRoundMaxReadout,
    tuningRoundWaitInput,
    tuningRoundWaitReadout,
    tuningRoundGrowthSelect,
    tuningSaveButton,
    tuningResetButton,
    tuningSaveStatus,
    levelProgressList,
    levelProgressCompleteButton,
    levelProgressResetButton,
    backgroundLabControls,
    backgroundFitModeSelect,
    backgroundShowGridToggle,
    backgroundShowSafeToggle,
    backgroundShowBaselineToggle,
    backgroundScrollSpeedInput,
    backgroundScrollReadout,
    runnerControls,
    runnerSeedInput,
    runnerSeedReadout,
    runnerDifficultyInput,
    runnerDifficultyReadout,
    runnerGapsInput,
    runnerGapsReadout,
    runnerLanesInput,
    runnerLanesReadout,
    runnerSpeedInput,
    runnerSpeedReadout,
    runnerShowPlanToggle,
    runnerShowHitboxesToggle,
    baselineControls,
    baselineLevelSelect,
    baselineShowHitboxesToggle,
    baselineShowSpawnGoalToggle,
    baselineShowCameraBandsToggle,
    elementEditorControls,
    elementLevelSelect,
    elementKindSelect,
    elementShowGridToggle,
    elementShowLabelsToggle,
    elementShowCollisionToggle,
    elementAddButton,
    elementDuplicateButton,
    elementDeleteButton,
    elementSaveButton,
    elementExportButton,
    elementEditorReadout,
    gymControls,
    gymExitButton,
    gymActorSelect,
    gymDirectionSelect,
    gymActionSelect,
    gymShowVisualToggle,
    gymShowCollisionToggle,
    gymShowAttackToggle,
    gymPlaybackRateInput,
    gymPlaybackReadout,
    gymFrameReadout,
    gymAttackFrameReadout,
    gymAttackFrameStrip,
    gymToggleCurrentHitFrameButton,
    gymOnlyCurrentHitFrameButton,
    gymClearHitFramesButton,
    gymResetHitFramesButton,
    gymBoundsKindSelect,
    gymBoundsXInput,
    gymBoundsYInput,
    gymBoundsWidthInput,
    gymBoundsHeightInput,
    gymSaveBoundsButton,
    gymResetBoundsButton,
    gymMirrorDirectionButton,
    gymApplyKindAllButton,
    gymApplyAllButton,
    gymLaneAnchorReadout,
    gymLaneAnchorXInput,
    gymLaneAnchorYInput,
    gymMirrorLaneAnchorButton,
    gymApplyLaneAnchorAllButton,
    gymSaveStatusElement,
    sceneReadout,
    fpsReadout,
    pointerReadout,
    inputReadout,
    playerReadout,
    enemyReadout,
    attackReadout,
    roundReadout
  };
}
