<script setup lang="ts">
import {reactive} from "vue";
import MonacoEditor from '@components/MonacoEditor.vue';
import * as monaco from "monaco-editor";
import singboxSchema from "@/schemas/sing-box.schema.json";
import {useFilterStore, useSubscriptionGeneratorStore} from "@/stores.ts";
import {storeToRefs} from "pinia";
import {ElMessage} from "element-plus";
import type {SubscriptionGenerator} from "@psc/common";
import {SubscriptionGeneratorCreateOrUpdateSchema} from "@psc/common";

const filterStore = useFilterStore();
const filterStoreRefs = storeToRefs(filterStore);
const filters = filterStoreRefs.filters;
const subscriptionGeneratorStore = useSubscriptionGeneratorStore();

const {toUpdateSubscriptionGenerator = undefined} = defineProps<{
  toUpdateSubscriptionGenerator?: SubscriptionGenerator,
}>();

const subscriptionGenerator = reactive({
  name: "",
  filterIds: [] as number[] | undefined,
  type: "url",
  url: undefined as string | undefined,
  content: undefined as string | undefined,
})

const visible = defineModel<boolean>("visible");

function onEditorMount() {
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    allowComments: true,
    schemas: [{
      uri: 'https://gist.githubusercontent.com/artiga033/fea992d95ad44dc8d024b229223b1002/raw/83c676c1ec9f37af2bce0505da396b5444b30032/sing-box.schema.json',
      fileMatch: ['*'],
      schema: singboxSchema
    }]
  })
}

function onOpen() {
  if (toUpdateSubscriptionGenerator) {
    subscriptionGenerator.name = toUpdateSubscriptionGenerator.name;
    subscriptionGenerator.filterIds = toUpdateSubscriptionGenerator.filterIds;
    subscriptionGenerator.type = toUpdateSubscriptionGenerator.type;
    switch (toUpdateSubscriptionGenerator.type) {
      case "url":
        subscriptionGenerator.url = toUpdateSubscriptionGenerator.url;
        break;
      case "json":
        subscriptionGenerator.content = toUpdateSubscriptionGenerator.content;
        break;
    }
  }
}

function validateJson() {
  if (subscriptionGenerator.content) {
    try {
      JSON.parse(subscriptionGenerator.content);
    } catch (e) {
      ElMessage.error(`无效的JSON:${getErrorMessage(e)}`)
    }
  } else {
    ElMessage.error("请输入JSON内容")
  }
}

function onConfirm() {
  if (subscriptionGenerator.type === "json") {
    validateJson();
  }

  const {data, error, success} = SubscriptionGeneratorCreateOrUpdateSchema.safeParse(subscriptionGenerator)
  if (!success) {
    debugger
    ElMessage.error(error.message);
    return;
  }
  const update = toUpdateSubscriptionGenerator ? subscriptionGeneratorStore.updateGenerator(toUpdateSubscriptionGenerator.id, data) : subscriptionGeneratorStore.createGenerator(data);
  update.then(() => visible.value = false)
      .catch((err) => {
        ElMessage.error(err.message);
      })
}

</script>

<template>
  <el-drawer title="订阅内容" v-model="visible" @open="onOpen">
    <template #header>
      <el-text>订阅内容</el-text>
    </template>
    <div class="drawer-content" style="display: flex; flex-direction: column; height: 100%">
      <el-form>
        <el-form-item>
          <el-input placeholder="请输入订阅名称" v-model="subscriptionGenerator.name"/>
        </el-form-item>
        <el-form-item>
          <el-select
              v-model="subscriptionGenerator.filterIds"
              multiple
              placeholder="Select"
          >
            <el-option
                v-for="item in filters"
                :key="item.id"
                :label="item.tag"
                :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-select v-model="subscriptionGenerator.type" placeholder="请选择模板类型">
            <el-option label="模板链接" value="url"/>
            <el-option label="输入模板" value="json"/>
          </el-select>
        </el-form-item>
        <el-form-item v-show="subscriptionGenerator.type === 'url'">
          <el-input placeholder="请输入模板链接"></el-input>
        </el-form-item>
      </el-form>
      <div v-show="subscriptionGenerator.type === 'json'" class="template-content" style="flex: 1">
        <MonacoEditor
            v-model="subscriptionGenerator.content"
            language="json"
            theme="vs-dark"
            height="100%"
            width="100%"
            @mounted="onEditorMount"
        />
      </div>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <el-button type="primary" @click="onConfirm">确 定</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped lang="scss">
</style>