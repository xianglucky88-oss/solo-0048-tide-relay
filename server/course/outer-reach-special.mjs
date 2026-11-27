import { outerReach } from './outer-reach.mjs'

// 专项班沿用外湾原航图（站点、航道、潮表、电量与校准时长），
// 仅把规则切到收发联调：期限 27 刻，得分来自交班当刻的计分链路。
export const outerReachSpecial = {
  ...outerReach,
  id: 'outer-reach-special',
  name: '外湾专项班',
  deadline: 27,
  mode: 'relay'
}
