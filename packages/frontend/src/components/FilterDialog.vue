<script setup lang="ts">
import {computed, reactive} from 'vue';
import {Filter} from '@psc/common';

const props = defineProps<{
  addFilter: (filter: Filter) => void,
  providerProxies: { tag: string, type: string, server: string }[]
}>();

const dialogVisible = defineModel<boolean>("dialogVisible");
const filter = reactive(new Filter());

const supportedTypes = computed(() => {
  const types = new Set<string>()
  props.providerProxies.forEach(proxy => {
    types.add(proxy.type)
  })
});

</script>
<template>
  <el-dialog title="添加过滤器" v-model="dialogVisible">
    <el-form :model="filter" label-width="100px">
      <el-form-item label="名称">
        <el-input v-model="filter.tag" placeholder="请输入名称"></el-input>
      </el-form-item>
      <el-form-item label="代理类型">
        <el-radio-group v-model="filter.type">
          <!--根据传入的supportedTypes数组，动态生成单选框-->
          <el-radio v-for="type in supportedTypes" :label="type" :key="type">
            {{ type }}
          </el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="包含">
        <el-input v-model="filter.includePattern" placeholder="请输入正则表达式"></el-input>
      </el-form-item>
      <el-form-item label="排除">
        <el-input v-model="filter.excludePattern" placeholder="请输入正则表达式"></el-input>
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="dialogVisible = false">取 消</el-button>
        <el-button type="primary" @click="addFilter(filter); dialogVisible = false">确 定</el-button>
      </div>
    </template>
  </el-dialog>
</template>