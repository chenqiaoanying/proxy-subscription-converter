<script setup lang="ts">
import {type DeepReadonly, reactive} from "vue";
import MonacoEditor from '@components/MonacoEditor.vue';
import * as monaco from "monaco-editor";
import singboxSchema from "@/schemas/sing-box.schema.json";
import {useFilterStore, useGeneratorStore} from "@/stores.ts";
import {storeToRefs} from "pinia";
import {ElMessage} from "element-plus";
import type {Generator} from "@psc/common";
import {GeneratorCreateOrUpdateSchema} from "@psc/common";

const filterStore = useFilterStore();
const filterStoreRefs = storeToRefs(filterStore);
const filters = filterStoreRefs.filters;
const subscriptionGeneratorStore = useGeneratorStore();

const {toUpdateGenerator = undefined} = defineProps<{
  toUpdateGenerator?: DeepReadonly<Generator>,
}>();

const subscriptionGenerator = reactive({
  name: "",
  filterIds: [] as number[],
  type: "url",
  url: "",
  content: "",
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
  subscriptionGenerator.name = "";
  subscriptionGenerator.filterIds = [];
  subscriptionGenerator.type = "url";
  subscriptionGenerator.url = "";
  subscriptionGenerator.content = "";
  if (toUpdateGenerator) {
    subscriptionGenerator.name = toUpdateGenerator.name;
    subscriptionGenerator.filterIds = toUpdateGenerator.filterIds.map((id) => id);
    subscriptionGenerator.type = toUpdateGenerator.type;
    switch (toUpdateGenerator.type) {
      case "url":
        subscriptionGenerator.url = toUpdateGenerator.url;
        subscriptionGenerator.content = "";
        break;
      case "json":
        subscriptionGenerator.url = "";
        subscriptionGenerator.content = JSON.stringify(toUpdateGenerator.content, null, 4);
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

  const {data, error, success} = GeneratorCreateOrUpdateSchema.safeParse(subscriptionGenerator)
  if (!success) {
    ElMessage.error(error.message);
    return;
  }
  const update = toUpdateGenerator ? subscriptionGeneratorStore.updateGenerator(toUpdateGenerator.id, data) : subscriptionGeneratorStore.createGenerator(data);
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
          <el-input placeholder="请输入模板链接" v-model="subscriptionGenerator.url"></el-input>
        </el-form-item>
      </el-form>
      <div v-show="subscriptionGenerator.type === 'json'" class="template-content" style="flex: 1">
        <MonacoEditor
            v-model="subscriptionGenerator.content"
            language="json"
            theme="vs-dark"
            height="100%"
            width="100%"
            @mount="onEditorMount"
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