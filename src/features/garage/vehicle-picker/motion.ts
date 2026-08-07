import {
  Easing,
  FadeIn,
  FadeInRight,
  FadeOut,
  FadeOutLeft,
  LinearTransition,
  ReduceMotion,
} from 'react-native-reanimated';

const easeOut = Easing.out(Easing.cubic);

export const pickerMotion = {
  pressInMs: 90,
  pressOutDamping: 20,
  pressOutStiffness: 260,
  stageEnter: FadeInRight.duration(280).easing(easeOut).reduceMotion(ReduceMotion.System),
  stageExit: FadeOutLeft.duration(170).easing(easeOut).reduceMotion(ReduceMotion.System),
  cardEnter: FadeIn.duration(220).easing(easeOut).reduceMotion(ReduceMotion.System),
  contentEnter: FadeIn.duration(240).easing(easeOut).reduceMotion(ReduceMotion.System),
  contentExit: FadeOut.duration(140).reduceMotion(ReduceMotion.System),
  layout: LinearTransition.duration(220).easing(easeOut).reduceMotion(ReduceMotion.System),
} as const;
