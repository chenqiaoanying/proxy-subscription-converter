<script setup lang="ts">
import {reactive, ref} from "vue";
import MonacoEditor from '@components/MonacoEditor.vue';
import * as monaco from "monaco-editor";
import singboxSchema from "@/schemas/sing-box.schema.json";
import {useFilterStore} from "@/stores.ts";
import {storeToRefs} from "pinia";

const filterStore = useFilterStore();
const filterStoreRefs = storeToRefs(filterStore);
const filters = filterStoreRefs.filters;
// const selectedFilters = ref<DeepReadonly<Filter>[]>([]);

const subscriptionGenerator = reactive({
  name: "",
  filterIds: [] as number[],
})

const visible = defineModel<boolean>("visible");
const templateType = ref<"url" | "raw">("url");
const templateContent = ref("");

const jsonError = ref(undefined as string | undefined)

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

function validateJson() {
  try {
    JSON.parse(templateContent.value);
    jsonError.value = undefined;
  } catch (e) {
    jsonError.value = `无效的JSON:${getErrorMessage(e)}`
  }
}

</script>

<template>
  <el-drawer title="订阅内容" v-model="visible">
    <template #header>
      <el-text>订阅内容</el-text>
    </template>
    <div class="drawer-content" style="display: flex; flex-direction: column; height: 100%">
      <el-form>
        <el-form-item>
          <el-input placeholder="请输入订阅名称"></el-input>
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
          <el-select v-model="templateType" placeholder="请选择模板类型">
            <el-option label="模板链接" value="url"/>
            <el-option label="输入模板" value="raw"/>
          </el-select>
        </el-form-item>
        <el-form-item v-show="templateType === 'url'">
          <el-input placeholder="请输入模板链接"></el-input>
        </el-form-item>
      </el-form>
      <div v-show="templateType === 'raw'" class="template-content" style="flex: 1">
        <MonacoEditor
            v-model="templateContent"
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
        <el-button type="primary" @click="visible = false">确 定</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped lang="scss">
</style>