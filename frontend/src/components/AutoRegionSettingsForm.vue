<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{
  subscriptionNames: string[]
}>()

const { t } = useI18n()

const groupType = defineModel<'selector' | 'urltest'>('groupType', { required: true })
const subGroupType = defineModel<'selector' | 'urltest'>('subGroupType', { required: true })
const regionsMode = defineModel<'auto' | 'custom'>('regionsMode', { required: true })
const regionsList = defineModel<string[]>('regionsList', { required: true })
const othersTag = defineModel<string>('othersTag', { required: true })
const useEmoji = defineModel<boolean>('useEmoji', { required: true })
const regionMapEntries = defineModel<{ keyword: string; region: string }[]>('regionMapEntries', { required: true })
const showRegionMap = defineModel<boolean>('showRegionMap', { required: true })

const isCustomRegions = computed(() => regionsMode.value === 'custom')

function addEntry() { regionMapEntries.value.push({ keyword: '', region: '' }) }
function removeEntry(idx: number) { regionMapEntries.value.splice(idx, 1) }
</script>

<template>
  <el-divider>{{ t('groups.autoRegionSettings') }}</el-divider>

  <el-form-item :label="t('groups.parentType')">
    <el-radio-group v-model="groupType">
      <el-radio value="selector">selector</el-radio>
      <el-radio value="urltest">urltest</el-radio>
    </el-radio-group>
  </el-form-item>

  <el-form-item :label="t('groups.subGroupType')">
    <el-radio-group v-model="subGroupType">
      <el-radio value="selector">selector</el-radio>
      <el-radio value="urltest">urltest</el-radio>
    </el-radio-group>
  </el-form-item>

  <el-form-item :label="t('groups.regions')">
    <div style="width: 100%">
      <el-radio-group v-model="regionsMode" style="margin-bottom: 8px">
        <el-radio value="auto">{{ t('groups.regionsAuto') }}</el-radio>
        <el-radio value="custom">{{ t('groups.regionsCustom') }}</el-radio>
      </el-radio-group>
      <template v-if="isCustomRegions">
        <el-select
          v-model="regionsList"
          multiple
          filterable
          allow-create
          default-first-option
          :placeholder="t('groups.regionsCustomPlaceholder')"
          style="width: 100%"
        />
        <el-text type="info" size="small">
          {{ t('groups.regionsCustomHint') }}
        </el-text>
      </template>
      <el-text v-else type="info" size="small">
        {{ t('groups.regionsAutoHint') }}
      </el-text>
    </div>
  </el-form-item>

  <el-form-item :label="t('groups.othersTag')">
    <el-input v-model="othersTag" :placeholder="t('groups.othersPlaceholder')" />
    <el-text type="info" size="small">
      {{ t('groups.othersHint', { regionToken: '{region}' }) }}
    </el-text>
  </el-form-item>

  <el-form-item :label="t('groups.emojiFlags')">
    <el-checkbox v-model="useEmoji">{{ t('groups.emojiFlagsLabel') }}</el-checkbox>
  </el-form-item>

  <el-form-item label="">
    <el-button size="small" link @click="showRegionMap = !showRegionMap">
      <el-icon><Setting /></el-icon>
      {{ showRegionMap ? t('groups.hideOverrides') : t('groups.showOverrides') }}
    </el-button>
  </el-form-item>

  <template v-if="showRegionMap">
    <el-form-item :label="t('groups.keywordOverrides')">
      <div style="width: 100%">
        <div
          v-for="(entry, idx) in regionMapEntries"
          :key="idx"
          style="display: flex; gap: 8px; margin-bottom: 6px"
        >
          <el-input v-model="entry.keyword" :placeholder="t('groups.keywordPlaceholder')" style="flex: 1" />
          <el-input v-model="entry.region" :placeholder="t('groups.regionCodePlaceholder')" style="flex: 0 0 100px" />
          <el-button size="small" type="danger" @click="removeEntry(idx)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
        <el-button size="small" @click="addEntry">
          <el-icon><Plus /></el-icon>
          {{ t('groups.addOverride') }}
        </el-button>
        <el-text type="info" size="small" style="margin-left: 8px">
          {{ t('groups.overrideHint') }}
        </el-text>
      </div>
    </el-form-item>
  </template>
</template>
