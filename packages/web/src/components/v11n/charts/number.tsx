import { css } from '@emotion/css'
import { useMemo } from 'react'
import numeral from 'numeral'

import type { Chart } from './base'
import { Type } from '../types'
import { formatRecord, isNumeric } from '../utils'
import { ConfigLabel } from '../components/ConfigLabel'
import { ConfigSelect } from '../components/ConfigSelect'
import { ThemingVariables } from '@app/styles'
import { useDataFieldsDisplayType } from '@app/hooks/useDataFieldsDisplayType'
import { useDataRecords } from '@app/hooks/useDataRecords'
import { ConfigSwitch } from '../components/ConfigSwitch'
import { ConfigInput } from '../components/ConfigInput'

export const number: Chart<Type.NUMBER> = {
  type: Type.NUMBER,

  initializeConfig(data, cache) {
    if (cache[Type.NUMBER]) {
      return cache[Type.NUMBER]!
    }
    const field = data.fields.find(({ displayType }) => isNumeric(displayType))
    return {
      type: Type.NUMBER,

      columns: data.fields.map(({ name }) => name),

      field: field?.name || '',
      compare: false
    }
  },

  Configuration(props) {
    const { onConfigChange } = props

    return (
      <div
        className={css`
          padding: 20px;
          width: 225px;
        `}
      >
        <ConfigLabel top={0}>Value</ConfigLabel>
        <ConfigSelect
          options={props.config.columns}
          value={props.config.field}
          onChange={(field) => {
            onConfigChange('field', field)
          }}
          placeholder="Please select"
        />
        <ConfigLabel>Compare</ConfigLabel>
        <ConfigSwitch
          value={!!props.config.compare}
          onChange={(compare) => {
            onConfigChange('compare', compare)
          }}
        />
        <ConfigLabel>Prefix</ConfigLabel>
        <ConfigInput
          value={props.config.prefix || ''}
          onChange={(prefix) => {
            onConfigChange('prefix', prefix)
          }}
        />
        <ConfigLabel>Suffix</ConfigLabel>
        <ConfigInput
          value={props.config.suffix || ''}
          onChange={(suffix) => {
            onConfigChange('suffix', suffix)
          }}
        />
      </div>
    )
  },

  Diagram(props) {
    const records = useDataRecords(props.data)
    const displayTypes = useDataFieldsDisplayType(props.data.fields)
    const fontSize = window.innerWidth / 32
    const maxChar = (props.dimensions.width / fontSize) * 1.8
    const numStr = useMemo(() => {
      const num = records[0]?.[props.config.field]
      if (!props.config?.field || num === undefined || typeof num !== 'number') {
        return ''
      }
      const str = formatRecord(num, displayTypes[props.config.field])
      if (str.length - maxChar <= 0) {
        return str
      }
      const shortest = numeral(num).format('0a')
      if (maxChar <= shortest.length + 2) {
        return shortest.toUpperCase()
      }
      return numeral(num).format('0[.][0]a').toUpperCase()
    }, [displayTypes, maxChar, props.config.field, records])
    const secondaryNumStr = useMemo(() => {
      if (!props.config.compare) {
        return ''
      }
      const num = records[0]?.[props.config.field]
      const secondaryNum = records[1]?.[props.config.field]
      if (
        !props.config?.field ||
        num === undefined ||
        typeof num !== 'number' ||
        secondaryNum === undefined ||
        typeof secondaryNum !== 'number'
      ) {
        return ''
      }
      if (secondaryNum === 0) {
        return ''
      }
      return `${(((num - secondaryNum) / secondaryNum) * 100).toFixed(2)}%`
    }, [props.config.field, props.config.compare, records])

    return (
      <div
        className={css`
          height: 100%;
          flex-direction: column;
          display: flex;
          align-items: center;
          justify-content: center;
        `}
      >
        <span
          className={css`
            max-width: 100%;
            color: ${ThemingVariables.colors.text[0]};
            white-space: nowrap;
            overflow: hidden;
            line-height: 1;
          `}
          style={{ fontSize }}
        >
          {props.config.prefix || ''}
          {numStr}
          {props.config.suffix || ''}
        </span>
        {secondaryNumStr ? (
          <span
            className={css`
              margin-top: 10px;
              color: ${secondaryNumStr.startsWith('-')
                ? ThemingVariables.colors.negative[0]
                : ThemingVariables.colors.positive[0]};
            `}
          >
            {secondaryNumStr.startsWith('-') ? null : '+'}
            {secondaryNumStr}
          </span>
        ) : null}
      </div>
    )
  }
}
