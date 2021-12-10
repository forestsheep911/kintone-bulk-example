/*
 * get bulk records example function
 * Copyright (c) 2021 Cybozu
 *
 * Licensed under the MIT License
 */

// npm 方式：
// npm i @kintone/rest-api-client
// import { KintoneRestAPIClient } from '@kintone/rest-api-client'
// cdn 方式：
// https://js.cybozu.cn/kintone-rest-api-client/1.4.0/KintoneRestAPIClient.min.js

const BASE_URL = 'https://yourdomain.cybozu.cn'
const APP_ID = '9999'
const API_TOKEN = 'yourApiToken'

const client = new KintoneRestAPIClient({
  baseUrl: BASE_URL,
  auth: {
    apiToken: API_TOKEN,
  },
})

// 使用SDK的方式批量获取数据,它会根据情况自动选择最优的方式。
// 不需要用户根据数据规模等情况来判断如何选择使用“记录ID法”、“游标法”、或“offset法”。
// 如果出现游标达到上限的提示，请加上 withCursor: false
async function getBulktRecordsViaSDK() {
  const queryParam = {
    app: APP_ID,
    fields: [''],
    condition: '',
    orderBy: '',
    // withCursor: false,
  }
  const result = await client.record.getAllRecords(queryParam)
  return result
}

// 使用记录ID的方法批量获取数据
async function getBulktRecordsViaId() {
  /*
   * @param {Object} params
   *   - app {String}: 应用ID（省略时表示当前打开的应用）
   *   - filterCond {String}: 筛选条件
   *   - sortConds {Array}: 排序条件的数组
   *   - fields {Array}: 要获取的字段的数组
   * @return {Object} response
   *   - records {Array}: 要获取的记录的数组
   */
  async function getRecords(_params) {
    const MAX_READ_LIMIT = 500
    const params = _params || {}
    const app = params.app || kintone.app.getId()
    const { filterCond } = params
    const sortConds = params.sortConds || ['$id asc']
    const { fields } = params
    let { data } = params

    if (!data) {
      data = {
        records: [],
        lastRecordId: 0,
      }
    }

    const conditions = []
    const limit = MAX_READ_LIMIT
    if (filterCond) {
      conditions.push(filterCond)
    }

    conditions.push(`$id > ${data.lastRecordId}`)

    const sortCondsAndLimit = ` order by ${sortConds.join(', ')} limit ${limit}`
    const query = conditions.join(' and ') + sortCondsAndLimit
    const body = {
      app,
      query,
    }

    if (fields && fields.length > 0) {
      // 因为是按照$id的排序来获取的，因此如果要获取的字段中没有“$id”字段，要追加进去
      if (fields.indexOf('$id') <= -1) {
        fields.push('$id')
      }
      body.fields = fields
    }

    const r = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', body)
    data.records = data.records.concat(r.records)
    if (r.records.length === limit) {
      // 如果获取的记录条数和limit一样，表示可能还有未获取的记录，因此要再回调getRecords，获取剩下的记录
      data.lastRecordId = r.records[r.records.length - 1].$id.value
      return getRecords({ app, filterCond, sortConds, fields, data })
    }
    delete data.lastRecordId
    return data
  }

  const params = {
    app: APP_ID,
    filterCond: '',
    // 排序条件按照['字段代码 asc或者desc']的形式指定
    sortConds: [''],
    fields: [''],
  }
  const result = await getRecords(params)
  return result.records
}

// 使用游标的方法批量获取数据
// 一万条以上请选此方法
// 如果出现游标达到上限的提示，请考虑其他方法
async function getBulktRecordsViaCursor() {
  /*
   * get all records function by cursor id sample program
   * Copyright (c) 2019 Cybozu
   *
   * Licensed under the MIT License
   */
  // 创建游标
  async function postCursor(_params) {
    const MAX_READ_LIMIT = 500
    const params = _params || {}
    const app = params.app || kintone.app.getId()
    const { filterCond } = params
    const { sortConds } = params
    const { fields } = params
    const conditions = []
    if (filterCond) {
      conditions.push(filterCond)
    }
    const sortCondsAndLimit = sortConds && sortConds.length > 0 ? ` order by ${sortConds.join(', ')}` : ''
    const query = conditions.join(' and ') + sortCondsAndLimit
    const body = {
      app,
      query,
      size: MAX_READ_LIMIT,
    }
    if (fields && fields.length > 0) {
      body.fields = fields
    }
    const r = await kintone.api(kintone.api.url('/k/v1/records/cursor', true), 'POST', body)
    return r.id
  }
  // 从创建的游标中获取记录
  async function getRecordsByCursorId(_params) {
    const params = _params || {}
    const { id } = params
    let { data } = params
    if (!data) {
      data = {
        records: [],
      }
    }
    const body = {
      id,
    }
    const r = await kintone.api(kintone.api.url('/k/v1/records/cursor', true), 'GET', body)
    data.records = data.records.concat(r.records)
    if (r.next) {
      return getRecordsByCursorId({ id, data })
    }
    return data
  }
  /*
   * @param {Object} params
   *   - app {String}: 应用ID（省略时表示当前打开的应用）
   *   - filterCond {String}: 筛选条件
   *   - sortConds {Array}: 排序条件的数组
   *   - fields {Array}: 要获取的字段的数组
   * @return {Object} response
   *   - records {Array}: 要获取的记录的数组
   */
  async function getRecords(_params) {
    const id = await postCursor(_params)
    return getRecordsByCursorId({ id })
  }

  const params = {
    app: APP_ID,
    filterCond: '',
    sortConds: [''],
    fields: [''],
  }
  const result = await getRecords(params)
  return result.records
}

// 使用offset的方法批量获取数据
// 一万条以上避免使用
// 如其他方法可用尽量避免此方法，因为性能不占优
async function getBulktRecordsViaOffset() {
  /*
   * @param {Object} _params
   *   - app {String}: 应用ID（省略时表示当前打开的应用）
   *   - filterCond {String}: 筛选条件
   *   - sortConds {Array}: 排序条件的数组
   *   - fields {Array}: 要获取的字段的数组
   *   - limit {Number}: 要获取的记录的条数（省略时获取符合筛选条件的所有记录）
   * @return {Object} response
   *   - records {Array}: 要获取的记录的数组
   */
  async function getRecords(_params) {
    const MAX_READ_LIMIT = 500
    const params = _params || {}
    const app = params.app || kintone.app.getId()
    const { filterCond } = params
    const { sortConds } = params
    const limit = params.limit || -1
    const offset = params.offset || 0
    const { fields } = params
    let { data } = params
    if (!data) {
      data = {
        records: [],
      }
    }
    let willBeDone = false
    let thisLimit = MAX_READ_LIMIT // 调用getRecords函数的那方指定了记录的获取条数时 //  willBeDone指定为true时，可在获取完指定的条数后退出。
    if (limit > 0) {
      if (thisLimit > limit) {
        thisLimit = limit
        willBeDone = true
      }
    }
    const conditions = []
    if (filterCond) {
      conditions.push(filterCond)
    }
    const sortCondsAndLimit = `
      ${sortConds && sortConds.length > 0 ? ` order by ${sortConds.join(', ')}` : ''} limit ${thisLimit}
    `
    const query = `${conditions.join(' and ') + sortCondsAndLimit} offset ${offset}`
    const body = {
      app,
      query,
    }
    if (fields && fields.length > 0) {
      body.fields = fields
    }
    const r = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', body)
    data.records = data.records.concat(r.records)
    const offSet = r.records.length
    if (limit > 0 && limit < offSet) {
      willBeDone = true
    } // 获取完该要获取的记录后退出
    if (offSet < thisLimit || willBeDone) {
      return data
    } // 如果该获取的记录还未获取完，再调用函数获取剩余记录
    return getRecords({
      app,
      filterCond,
      sortConds,
      limit: limit - offSet,
      offset: offset + offSet,
      fields,
      data,
    })
  }

  const params = {
    app: APP_ID,
    filterCond: '',
    sortConds: [''],
    fields: [''],
  }
  const result = await getRecords(params)
  return result.records
}

kintone.events.on('app.record.index.show', async (event) => {
  // 1. SDK
  const result0 = await getBulktRecordsViaSDK()
  console.log(result0.length)
  // 2. 记录ID
  const result1 = await getBulktRecordsViaId()
  console.log(result1.length)
  // 2. 游标
  const result2 = await getBulktRecordsViaCursor()
  console.log(result2.length)
  // 4. offset
  const result3 = await getBulktRecordsViaOffset()
  console.log(result3.length)
  return event
})
