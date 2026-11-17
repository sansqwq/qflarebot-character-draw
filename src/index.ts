import { definePlugin } from '@qqbot/sdk'

interface Config { characters: string }

export default definePlugin<Config>({
  name: 'character-draw',
  apiVersion: 1,
  displayName: '随机抽角色',
  description: '群里单独 @ 机器人时随机抽取一个角色。',
  configSchema: {
    type: 'object',
    properties: {
      characters: {
        type: 'string',
        format: 'textarea',
        title: '角色列表',
        description: '每行一个角色，格式：角色名 | 图片直链；没有图片时只写名字。',
      },
    },
  },
  defaultConfig: { characters: '太刀侠\n0大人\n蒸蛋\n邦尼\n雪莉\n露露\n蓝海晴' },
  cron: {
    goodmorning: {
      cron: '0 0 * * *', // 北京时间 08:00
      async handler({ ctx }) {
        for (const key of await ctx.kv.list('goodnight-group:')) {
          const groupId = key.slice('goodnight-group:'.length)
          const result = await ctx.api.sendMessage({ scene: 'group', id: groupId }, '大家早上好喵，今天也要开开心心哦')
          if (!result.ok) ctx.logger.warn('早安消息发送失败', { status: result.status, error: result.error })
        }
      },
    },
    goodnight: {
      cron: '50 14 * * *', // 北京时间 22:50
      async handler({ ctx }) {
        for (const key of await ctx.kv.list('goodnight-group:')) {
          const groupId = key.slice('goodnight-group:'.length)
          const result = await ctx.api.sendMessage({ scene: 'group', id: groupId }, 'emm...看板娘有点困了，大家晚安啦')
          if (!result.ok) ctx.logger.warn('晚安消息发送失败', { status: result.status, error: result.error })
        }
      },
    },
  },
  events: {
    'qq.group.robot_added': async ({ session, ctx }) => {
      if (session.targetId) await ctx.kv.put(`goodnight-group:${session.targetId}`, '1')
      return '哼哼，我是由美咕噜超可爱会长设计的吉星派对看板娘喵，大家可以@我来抽角色玩'
    },
    'qq.group.robot_removed': async ({ session, ctx }) => {
      if (session.targetId) await ctx.kv.delete(`goodnight-group:${session.targetId}`)
    },
    'qq.group.member_added': async ({ session, ctx }) => {
      if (!session.userId) {
        ctx.logger.warn('群成员加入事件缺少成员标识，无法发送欢迎语')
        return
      }
      const text = '看板娘在这里欢迎新人进群喵，可以@我来抽角色玩喵'
      const result = await session.send({ text, markdown: { content: `<qqbot-at-user id="${session.userId}" />，${text}` } })
      if (!result.ok) ctx.logger.warn('欢迎新人消息发送失败', { status: result.status, error: result.error })
    },
    'qq.group.at_message': async ({ session, ctx }) => {
      if (!session.atMe || session.addressedToOthers) return
      if (session.targetId) {
        const key = `goodnight-group:${session.targetId}`
        try { if (!await ctx.kv.get(key)) await ctx.kv.put(key, '1') }
        catch (error) { ctx.logger.warn('保存晚安消息群失败', { error: String(error) }) }
      }
      const content = session.content.trim()
      const normalize = (value: string) => value.trim().replace(/[\s！!。.?？]+$/g, '')
      const keyFor = (question: string) => `qa:${session.targetId}:${encodeURIComponent(normalize(question))}`
      const teaching = content.match(/^教你\s*[:：]\s*([\s\S]+?)\s+答\s*[:：]\s*([\s\S]+)$/)
      const forgetting = content.match(/^忘记(?:\s*[:：]\s*|\s+)([\s\S]+)$/)
      if (/^教你(?:\s|[:：]|$)/.test(content) && !teaching) return '教我说话的格式是：@我 教你：你好 答：你好喵，今天也要开开心心哦'
      if (teaching || forgetting) {
        const question = normalize((teaching?.[1] ?? forgetting?.[1] ?? ''))
        const answer = teaching?.[2]?.trim() ?? ''
        if (!session.targetId || !question || question.length > 40 || (teaching && (!answer || answer.length > 500))) {
          return '要对我说的话请控制在 40 字以内，回答请控制在 500 字以内喵。'
        }
        if (/^(?:抽角色|换一个|介绍下你自己|介绍一下你自己)$/.test(question)) return '这是看板娘已有的功能，不能修改喵。'
        try {
          if (teaching) { await ctx.kv.put(keyFor(question), answer); return `记住啦！以后对我说「${question}」，我就会这样回答喵。` }
          await ctx.kv.delete(keyFor(question))
          return `已经忘记「${question}」啦。`
        } catch (error) {
          ctx.logger.warn('保存群问答失败', { error: String(error) })
          return '保存失败了，请稍后再试喵。'
        }
      }
      if (/^(?:介绍下你自己|介绍一下你自己)[\s！!。.?？]*$/.test(content)) {
        return '哼哼，我是由美咕噜超可爱会长设计的吉星派对看板娘喵，大家可以@我来抽角色玩'
      }
      if (content && !/^(?:抽角色|换一个)[\s！!。.?？]*$/.test(content)) {
        const question = normalize(content)
        if (session.targetId && question && question.length <= 40) {
          try { const answer = await ctx.kv.get(keyFor(question)); if (answer) return answer }
          catch (error) { ctx.logger.warn('读取群问答失败', { error: String(error) }) }
        }
        return '这句话我还不会回答喵，可以这样教我：@我 教你：你好 答：你好喵，今天也要开开心心哦'
      }
      const entries = ctx.config.characters.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
      if (!entries.length) return '角色池还是空的，请在机器人面板中添加角色。'
      const [name, image] = entries[Math.floor(Math.random() * entries.length)]!.split('|').map(s => s.trim())
      if (!name) return '角色配置有误，请在面板中检查。'
      if (!image || !/^https:\/\//i.test(image)) return `你抽到了：${name}`
      const result = await session.reply({ text: `你抽到了：${name}`, image: { url: image } })
      if (!result.ok) return `你抽到了：${name}（图片发送失败，请再试一次喵）`
    },
  },
})
